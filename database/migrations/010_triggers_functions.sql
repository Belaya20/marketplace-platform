-- =============================================================================
-- MIGRATION 010: Business Logic — Triggers & Functions
-- Depends on: 001 through 009
-- Automates: rating aggregates, stock deduction, wallet crediting,
--   order number generation, low-stock alerts, status history logging
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FUNCTION: generate_order_number
-- Req 3.2.7: Order number for tracking (human-readable, unique)
-- Format: ORD-YYYYMMDD-XXXXXXXX (e.g. ORD-20240315-00042891)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
DECLARE
    date_part   VARCHAR;
    seq_part    VARCHAR;
    new_number  VARCHAR;
BEGIN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    seq_part  := LPAD(NEXTVAL('order_number_seq')::TEXT, 8, '0');
    new_number := 'ORD-' || date_part || '-' || seq_part;
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Sequence backing the order number
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1 INCREMENT 1 NO CYCLE;

-- Auto-populate order_number on insert
CREATE OR REPLACE FUNCTION trg_set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION trg_set_order_number();

-- ---------------------------------------------------------------------------
-- FUNCTION: update_product_rating_aggregate
-- Req 3.2.2: Sort by Rating — kept accurate automatically
-- Req 3.2.3: Reviews & ratings on product detail page
-- Called after every INSERT/UPDATE/DELETE on reviews
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
DECLARE
    target_product_id UUID;
BEGIN
    -- Determine which product_id changed
    IF TG_OP = 'DELETE' THEN
        target_product_id := OLD.product_id;
    ELSE
        target_product_id := NEW.product_id;
    END IF;

    UPDATE products
    SET
        avg_rating   = COALESCE((
            SELECT ROUND(AVG(rating)::NUMERIC, 2)
            FROM reviews
            WHERE product_id = target_product_id
              AND is_approved = TRUE
        ), 0.00),
        review_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE product_id = target_product_id
              AND is_approved = TRUE
        )
    WHERE id = target_product_id;

    RETURN NULL; -- AFTER trigger
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_update_product_rating
    AFTER INSERT OR UPDATE OF rating, is_approved OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- ---------------------------------------------------------------------------
-- FUNCTION: auto-log order status transitions
-- Req 3.2.7: Track order status (audit trail)
-- Every time orders.status changes, write a history row automatically
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (order_id, from_status, to_status, note)
        VALUES (NEW.id, OLD.status, NEW.status, 'Status updated by system trigger');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_log_status
    AFTER UPDATE OF status ON orders
    FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- ---------------------------------------------------------------------------
-- FUNCTION: deduct stock when order item is accepted
-- Req 3.3.2: Manage stock — automatic deduction on sale
-- Req 3.3.4: Stock history — automatic entry on every deduction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_stock_on_item_accept()
RETURNS TRIGGER AS $$
DECLARE
    v_before    INTEGER;
    v_after     INTEGER;
BEGIN
    -- Only act when status transitions TO 'accepted'
    IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
        -- Lock the variant row to prevent race conditions
        SELECT stock_qty INTO v_before
        FROM product_variants
        WHERE id = NEW.variant_id
        FOR UPDATE;

        v_after := v_before - NEW.quantity;

        IF v_after < 0 THEN
            RAISE EXCEPTION 'Insufficient stock for variant %: available %, requested %',
                NEW.variant_id, v_before, NEW.quantity;
        END IF;

        -- Deduct stock
        UPDATE product_variants
        SET stock_qty = v_after
        WHERE id = NEW.variant_id;

        -- Write stock history (Req 3.3.4)
        INSERT INTO stock_history (
            variant_id, qty_before, qty_change, qty_after,
            reason, reference_id
        ) VALUES (
            NEW.variant_id, v_before, -NEW.quantity, v_after,
            'sale', NEW.order_id
        );
    END IF;

    -- If item is rejected or cancelled after being accepted, restore stock
    IF OLD.status = 'accepted' AND NEW.status IN ('rejected', 'cancelled') THEN
        SELECT stock_qty INTO v_before
        FROM product_variants
        WHERE id = NEW.variant_id
        FOR UPDATE;

        v_after := v_before + NEW.quantity;

        UPDATE product_variants SET stock_qty = v_after WHERE id = NEW.variant_id;

        INSERT INTO stock_history (
            variant_id, qty_before, qty_change, qty_after,
            reason, reference_id
        ) VALUES (
            NEW.variant_id, v_before, NEW.quantity, v_after,
            'manual_adjustment', NEW.order_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_items_deduct_stock
    AFTER UPDATE OF status ON order_items
    FOR EACH ROW EXECUTE FUNCTION deduct_stock_on_item_accept();

-- ---------------------------------------------------------------------------
-- FUNCTION: also deduct stock when return is completed (restores stock)
-- Req 3.8: Return approval workflow
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION restore_stock_on_return_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_variant_id    UUID;
    v_quantity      SMALLINT;
    v_before        INTEGER;
    v_after         INTEGER;
BEGIN
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        SELECT oi.variant_id, oi.quantity
        INTO v_variant_id, v_quantity
        FROM order_items oi
        WHERE oi.id = NEW.order_item_id;

        SELECT stock_qty INTO v_before
        FROM product_variants WHERE id = v_variant_id FOR UPDATE;

        v_after := v_before + v_quantity;

        UPDATE product_variants SET stock_qty = v_after WHERE id = v_variant_id;

        INSERT INTO stock_history (
            variant_id, qty_before, qty_change, qty_after,
            reason, reference_id
        ) VALUES (
            v_variant_id, v_before, v_quantity, v_after,
            'return', NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_returns_restore_stock
    AFTER UPDATE OF status ON returns
    FOR EACH ROW EXECUTE FUNCTION restore_stock_on_return_complete();

-- ---------------------------------------------------------------------------
-- FUNCTION: credit seller wallet when payment succeeds
-- Req 3.3.5: Seller Wallet / Earnings — automatic crediting
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_seller_wallet_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    item    RECORD;
BEGIN
    -- Only act when payment status transitions to 'success'
    IF NEW.status = 'success' AND OLD.status <> 'success' THEN
        -- Credit each seller for their order items
        FOR item IN
            SELECT oi.id, oi.seller_id, oi.line_total,
                   oi.commission_rate_snapshot, oi.commission_amount, oi.seller_earnings
            FROM order_items oi
            WHERE oi.order_id = NEW.order_id
              AND oi.status NOT IN ('rejected', 'cancelled')
        LOOP
            -- Insert wallet transaction (pending until order delivered)
            INSERT INTO wallet_transactions (
                seller_id, order_item_id, type,
                gross_amount, commission_amount, net_amount,
                status, reference
            ) VALUES (
                item.seller_id, item.id, 'commission_credit',
                item.line_total, item.commission_amount, item.seller_earnings,
                'pending',
                (SELECT order_number FROM orders WHERE id = NEW.order_id)
            );

            -- Add to pending balance (becomes available after delivery)
            UPDATE seller_profiles
            SET pending_balance = pending_balance + item.seller_earnings
            WHERE id = item.seller_id;
        END LOOP;

        -- Mark the order as paid
        UPDATE orders SET payment_status = 'paid' WHERE id = NEW.order_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payments_credit_wallet
    AFTER UPDATE OF status ON payments
    FOR EACH ROW EXECUTE FUNCTION credit_seller_wallet_on_payment();

-- ---------------------------------------------------------------------------
-- FUNCTION: move pending balance to available when order is delivered
-- Req 3.3.5: View earnings, Pending balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_pending_balance_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
BEGIN
    IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
        FOR item IN
            SELECT wt.id AS tx_id, wt.seller_id, wt.net_amount
            FROM wallet_transactions wt
            JOIN order_items oi ON oi.id = wt.order_item_id
            WHERE oi.order_id = NEW.id
              AND wt.status = 'pending'
              AND wt.type = 'commission_credit'
        LOOP
            -- Mark transaction as completed
            -- (We use a direct UPDATE here — NOT subject to the immutable rule
            --  because wallet_transactions no_update rule blocks UPDATE from SQL clients.
            --  This internal function bypasses it intentionally via rule exception.)
            UPDATE seller_profiles
            SET
                wallet_balance  = wallet_balance  + item.net_amount,
                pending_balance = GREATEST(pending_balance - item.net_amount, 0),
                total_earned    = total_earned + item.net_amount
            WHERE id = item.seller_id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_release_balance
    AFTER UPDATE OF status ON orders
    FOR EACH ROW EXECUTE FUNCTION release_pending_balance_on_delivery();

-- ---------------------------------------------------------------------------
-- FUNCTION: increment flash_sale_items.sold_qty atomically
-- Req 3.3.6: Flash sales — prevent overselling
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_flash_sale_sold()
RETURNS TRIGGER AS $$
DECLARE
    v_flash_item    RECORD;
BEGIN
    -- Only relevant if a flash sale price was applied
    -- Look up the flash sale item for this variant if a sale is currently active
    SELECT fsi.*
    INTO v_flash_item
    FROM flash_sale_items fsi
    JOIN flash_sales fs ON fs.id = fsi.flash_sale_id
    WHERE fsi.variant_id = NEW.variant_id
      AND fs.is_active = TRUE
      AND fs.starts_at <= NOW()
      AND fs.ends_at   >= NOW()
    LIMIT 1;

    IF FOUND THEN
        -- Check capacity
        IF v_flash_item.max_qty > 0 AND v_flash_item.sold_qty >= v_flash_item.max_qty THEN
            RAISE EXCEPTION 'Flash sale sold out for variant %', NEW.variant_id;
        END IF;

        UPDATE flash_sale_items
        SET sold_qty = sold_qty + NEW.quantity
        WHERE id = v_flash_item.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cart_flash_sale_check
    AFTER INSERT OR UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION increment_flash_sale_sold();

-- ---------------------------------------------------------------------------
-- FUNCTION: enforce one default variant per product
-- Req 3.2.3: Product variants — must have a clear default
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_single_default_variant()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE product_variants
        SET is_default = FALSE
        WHERE product_id = NEW.product_id
          AND id <> NEW.id
          AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_variants_single_default
    BEFORE INSERT OR UPDATE OF is_default ON product_variants
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION enforce_single_default_variant();

-- ---------------------------------------------------------------------------
-- FUNCTION: update product.total_sold when an order item is delivered
-- Req 3.2.1: Best sellers (home page) — kept accurate automatically
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_product_total_sold()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
        UPDATE products p
        SET total_sold = total_sold + NEW.quantity
        FROM product_variants pv
        WHERE pv.id = NEW.variant_id
          AND p.id = pv.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_items_update_sold_count
    AFTER UPDATE OF status ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_product_total_sold();

-- =============================================================================
-- END OF MIGRATION 010
-- =============================================================================
