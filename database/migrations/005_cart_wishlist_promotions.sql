-- =============================================================================
-- MIGRATION 005: Cart, Wishlist & Promotions
-- Depends on: 001, 002, 003, 004
-- Covers requirements: 3.2.4 Cart Management, 3.2.8 Wishlist,
--   3.3.6 Promotions, Flash Sales
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: cart_items
-- Req 3.2.4: Add to cart, Update quantity, Remove item, View cart summary
-- Req 3.2.4: Calculate shipping cost (cart total used to calc shipping)
-- Guest carts: user_id references users who may have role='guest',
--              or use session_id column for anonymous carts
-- ---------------------------------------------------------------------------
CREATE TABLE cart_items (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant_id      UUID        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity        SMALLINT    NOT NULL DEFAULT 1,
    added_at        TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    -- One row per user+variant combination
    CONSTRAINT cart_items_user_variant_unique UNIQUE (user_id, variant_id),
    CONSTRAINT cart_items_qty_positive CHECK (quantity > 0)
);

CREATE TRIGGER trg_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: wishlists
-- Req 3.2.8: Add product to wishlist, Remove product, Move to cart
-- Stored at product level — variant chosen when user moves to cart
-- ---------------------------------------------------------------------------
CREATE TABLE wishlists (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at    TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT wishlists_user_product_unique UNIQUE (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- TABLE: flash_sales
-- Req 3.3.6: Participate in flash sales
-- Req 3.2.1: Flash sales section (home page)
-- Admin creates the flash sale event; sellers opt their variants in
-- ---------------------------------------------------------------------------
CREATE TABLE flash_sales (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by      UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title           VARCHAR(255)    NOT NULL,
    description     TEXT,
    banner_url      TEXT,
    starts_at       TIMESTAMP WITH TIME ZONE    NOT NULL,
    ends_at         TIMESTAMP WITH TIME ZONE    NOT NULL,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT flash_sales_dates_valid CHECK (ends_at > starts_at)
);

CREATE TRIGGER trg_flash_sales_updated_at
    BEFORE UPDATE ON flash_sales
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: flash_sale_items
-- Req 3.3.6: Participate in flash sales
-- sold_qty is the atomic counter — incremented on each sale, never goes > max_qty
-- ---------------------------------------------------------------------------
CREATE TABLE flash_sale_items (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id   UUID        NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
    variant_id      UUID        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    sale_price      DECIMAL(12,2)   NOT NULL,
    max_qty         INTEGER     NOT NULL DEFAULT 0,   -- 0 = unlimited
    sold_qty        INTEGER     NOT NULL DEFAULT 0,

    CONSTRAINT flash_sale_items_unique          UNIQUE (flash_sale_id, variant_id),
    CONSTRAINT flash_sale_price_positive        CHECK (sale_price > 0),
    CONSTRAINT flash_sale_max_qty_non_neg       CHECK (max_qty >= 0),
    CONSTRAINT flash_sale_sold_lte_max          CHECK (max_qty = 0 OR sold_qty <= max_qty)
);

-- ---------------------------------------------------------------------------
-- TABLE: discount_rules
-- Req 3.3.6: Create discount offers
-- Seller-scoped coupon codes with percentage/fixed/free-shipping types
-- ---------------------------------------------------------------------------
CREATE TABLE discount_rules (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- NULL seller_id means platform-wide admin coupon
    seller_id           UUID            REFERENCES seller_profiles(id) ON DELETE CASCADE,
    created_by          UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    code                VARCHAR(50)     NOT NULL UNIQUE,
    type                discount_type   NOT NULL,
    value               DECIMAL(10,2)   NOT NULL,           -- % or fixed ETB amount

    -- Eligibility constraints
    min_order_amount    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    max_discount_cap    DECIMAL(12,2),                      -- max ETB off for % discounts

    -- Usage limits
    max_uses            INTEGER,                             -- NULL = unlimited
    max_uses_per_user   SMALLINT        NOT NULL DEFAULT 1,
    used_count          INTEGER         NOT NULL DEFAULT 0,

    -- Validity window
    starts_at           TIMESTAMP WITH TIME ZONE,
    expires_at          TIMESTAMP WITH TIME ZONE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT discount_value_positive  CHECK (value > 0),
    CONSTRAINT discount_pct_max_100     CHECK (type <> 'percentage' OR value <= 100),
    CONSTRAINT discount_used_lte_max    CHECK (max_uses IS NULL OR used_count <= max_uses),
    CONSTRAINT discount_dates_valid     CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);

CREATE TRIGGER trg_discount_rules_updated_at
    BEFORE UPDATE ON discount_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: discount_usages
-- Tracks which user used which coupon (for per-user limit enforcement)
-- ---------------------------------------------------------------------------
CREATE TABLE discount_usages (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    discount_rule_id    UUID    NOT NULL REFERENCES discount_rules(id) ON DELETE CASCADE,
    user_id             UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id            UUID,                               -- FK added after orders table
    used_at             TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT discount_usages_unique UNIQUE (discount_rule_id, user_id, order_id)
);

-- =============================================================================
-- END OF MIGRATION 005
-- =============================================================================
