-- =============================================================================
-- MIGRATION 006: Orders, Payments & Returns
-- Depends on: 001, 002, 003, 004, 005
-- Covers requirements: 3.2.5 Checkout, 3.2.6 Payment Integration (Chapa),
--   3.2.7 Order Management, 3.3.3 Seller Order Management, 3.8 Returns,
--   3.4.5 Admin Order Management, 3.7 Shipping & Logistics
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: orders
-- Req 3.2.5: Checkout process — address, shipping, payment, summary, confirm
-- Req 3.2.7: View order history, track order status, download invoice, reorder
-- Req 3.4.5: View all orders, update order status
-- Req 3.2.6: Chapa payment, cash on delivery
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
    id                          UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id                 UUID                    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    shipping_zone_id            UUID                    REFERENCES shipping_zones(id) ON DELETE SET NULL,
    discount_rule_id            UUID                    REFERENCES discount_rules(id) ON DELETE SET NULL,

    -- Human-readable order number (Req 3.2.7)
    order_number                VARCHAR(30)             NOT NULL UNIQUE,

    -- Status state machine (Req 3.2.7: 7 statuses)
    status                      order_status            NOT NULL DEFAULT 'pending',
    payment_status              order_payment_status    NOT NULL DEFAULT 'unpaid',

    -- Frozen address snapshot — NOT a FK (Req: address can change later)
    shipping_address_snapshot   JSONB                   NOT NULL,

    -- Shipping (Req 3.7: Tracking number entry)
    shipping_method             VARCHAR(100),
    tracking_number             VARCHAR(200),

    -- Financials (all ETB)
    subtotal                    DECIMAL(14,2)           NOT NULL DEFAULT 0.00,
    shipping_cost               DECIMAL(14,2)           NOT NULL DEFAULT 0.00,
    discount_amount             DECIMAL(14,2)           NOT NULL DEFAULT 0.00,
    tax_amount                  DECIMAL(14,2)           NOT NULL DEFAULT 0.00,
    total                       DECIMAL(14,2)           NOT NULL DEFAULT 0.00,

    -- Chapa payment reference (Req 3.2.6: Secure API-based payment verification)
    payment_method              VARCHAR(50),     -- 'chapa', 'cod'
    chapa_tx_ref                VARCHAR(200)     UNIQUE,

    -- Invoice (Req 3.2.7: Download invoice)
    invoice_url                 TEXT,

    -- Notes
    customer_note               TEXT,
    admin_note                  TEXT,

    placed_at                   TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT orders_subtotal_non_neg      CHECK (subtotal >= 0),
    CONSTRAINT orders_shipping_non_neg      CHECK (shipping_cost >= 0),
    CONSTRAINT orders_discount_non_neg      CHECK (discount_amount >= 0),
    CONSTRAINT orders_tax_non_neg           CHECK (tax_amount >= 0),
    CONSTRAINT orders_total_non_neg         CHECK (total >= 0)
);

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add FK from discount_usages.order_id now that orders exists
ALTER TABLE discount_usages
    ADD CONSTRAINT discount_usages_order_fk
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- TABLE: order_status_history
-- Req 3.2.7: Track order status (full audit log of every transition)
-- Req 3.4.5: Admin update order status (who changed it)
-- Append-only — never update or delete
-- ---------------------------------------------------------------------------
CREATE TABLE order_status_history (
    id          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id    UUID            NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    changed_by  UUID            REFERENCES users(id) ON DELETE SET NULL,
    from_status order_status,
    to_status   order_status    NOT NULL,
    note        TEXT,
    changed_at  TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

CREATE RULE order_status_history_no_update AS ON UPDATE TO order_status_history DO INSTEAD NOTHING;
CREATE RULE order_status_history_no_delete AS ON DELETE TO order_status_history DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------------
-- TABLE: order_items
-- Req 3.3.3: View new orders, accept/reject, update order status (per seller)
-- Req 3.2.7: Track order status per item
-- Snapshot columns protect historical data if product is edited later
-- ---------------------------------------------------------------------------
CREATE TABLE order_items (
    id                          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id                    UUID            NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    variant_id                  UUID            REFERENCES product_variants(id) ON DELETE SET NULL,
    seller_id                   UUID            NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,

    -- Frozen snapshots (Req: product data must not change on historical orders)
    product_name_snapshot       VARCHAR(500)    NOT NULL,
    sku_snapshot                VARCHAR(100)    NOT NULL,
    variant_attributes_snapshot JSONB,          -- e.g. {"Size":"XL","Color":"Red"}
    unit_price_snapshot         DECIMAL(12,2)   NOT NULL,
    discount_price_snapshot     DECIMAL(12,2),

    quantity                    SMALLINT        NOT NULL,
    line_total                  DECIMAL(14,2)   NOT NULL,

    -- Per-item seller fulfillment status (Req 3.3.3)
    status                      item_status     NOT NULL DEFAULT 'pending',
    rejection_reason            TEXT,
    tracking_number             VARCHAR(200),   -- seller enters when shipped

    -- Seller commission calculation
    commission_rate_snapshot    DECIMAL(5,2)    NOT NULL DEFAULT 10.00,
    commission_amount           DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    seller_earnings             DECIMAL(12,2)   NOT NULL DEFAULT 0.00,

    updated_at                  TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT order_items_qty_positive     CHECK (quantity > 0),
    CONSTRAINT order_items_unit_price_pos   CHECK (unit_price_snapshot > 0),
    CONSTRAINT order_items_line_total_pos   CHECK (line_total > 0)
);

CREATE TRIGGER trg_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: payments
-- Req 3.2.6: Chapa Payment Gateway Integration
-- Req 3.2.6: Secure API-based payment verification
-- Req 3.2.6: Payment confirmation callback handling
-- Req 3.4.6: View transactions, Payment logs monitoring
-- Raw webhook payload always preserved — never discard
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id                UUID            NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    chapa_tx_ref            VARCHAR(200)    NOT NULL UNIQUE,
    chapa_checkout_url      TEXT,

    amount                  DECIMAL(14,2)   NOT NULL,
    currency                VARCHAR(5)      NOT NULL DEFAULT 'ETB',
    payment_method_detail   VARCHAR(100),   -- 'telebirr', 'mpesa', 'bank_transfer', 'cod'

    status                  payment_status  NOT NULL DEFAULT 'initiated',

    -- Full raw response from Chapa (Req 3.2.6: callback handling)
    chapa_webhook_payload   JSONB,
    chapa_verify_payload    JSONB,

    failure_reason          TEXT,

    initiated_at            TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    verified_at             TIMESTAMP WITH TIME ZONE,

    CONSTRAINT payments_amount_positive CHECK (amount > 0)
);

-- ---------------------------------------------------------------------------
-- TABLE: returns
-- Req 3.8: Return request submission
-- Req 3.8: Return approval workflow
-- Req 3.8: Return status tracking
-- Req 3.2.7: Request return (customer)
-- Req 3.3.3: Manage returns (seller)
-- ---------------------------------------------------------------------------
CREATE TABLE returns (
    id              UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id   UUID                NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
    customer_id     UUID                NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_id       UUID                NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,

    -- Return request details (Req 3.8)
    reason          TEXT                NOT NULL,
    evidence_urls   JSONB               NOT NULL DEFAULT '[]',  -- array of image URLs

    -- Workflow (Req 3.8: approval workflow)
    status          return_status       NOT NULL DEFAULT 'requested',
    resolution      return_resolution,
    refund_amount   DECIMAL(12,2),

    -- Notes
    seller_note     TEXT,
    admin_note      TEXT,

    reviewed_by     UUID                REFERENCES users(id) ON DELETE SET NULL,

    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMP WITH TIME ZONE,
    updated_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    -- One active return per order item at a time
    CONSTRAINT returns_one_per_item UNIQUE (order_item_id)
);

CREATE TRIGGER trg_returns_updated_at
    BEFORE UPDATE ON returns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- END OF MIGRATION 006
-- =============================================================================
