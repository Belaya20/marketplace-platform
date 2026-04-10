-- =============================================================================
-- MIGRATION 004: Products & Variants
-- Depends on: 001, 002, 003
-- Covers requirements: 3.3.2 Product Management, 3.2.3 Product Details Page,
--   3.4.4 Product Management (admin), 3.3.4 Inventory Management
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: products
-- Req 3.3.2: Add product, Edit product, Delete product
-- Req 3.2.3: Product name, description, images, price, seller info, reviews
-- Req 3.4.4: Approve seller products, feature products
-- Req 3.2.2: Browse by categories, filter by brand, filter by rating
-- ---------------------------------------------------------------------------
CREATE TABLE products (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id           UUID            NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
    category_id         UUID            NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id            UUID            REFERENCES brands(id) ON DELETE SET NULL,

    -- Core fields (Req 3.3.2: Product Fields)
    name                VARCHAR(500)    NOT NULL,
    slug                VARCHAR(550)    NOT NULL UNIQUE,
    short_description   VARCHAR(500),
    full_description    TEXT,

    -- Status workflow (Req 3.4.4: Approve seller products)
    -- draft → pending_review → active | rejected → archived
    status              product_status  NOT NULL DEFAULT 'draft',
    rejection_reason    TEXT,
    reviewed_by         UUID            REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMP WITH TIME ZONE,

    -- Discovery (Req 3.4.4: Feature products, Req 3.2.1: Featured products)
    is_featured         BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Denormalized aggregates — updated by triggers for fast listing queries
    -- Req 3.2.2: Sort by Rating, Req 3.2.9: Reviews & Ratings
    avg_rating          DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
    review_count        INTEGER         NOT NULL DEFAULT 0,
    total_sold          INTEGER         NOT NULL DEFAULT 0,

    -- SEO (Req 4.5: Responsive design — implies proper meta)
    meta_title          VARCHAR(255),
    meta_description    VARCHAR(500),

    created_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT products_name_not_empty  CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT products_avg_rating_range CHECK (avg_rating BETWEEN 0 AND 5),
    CONSTRAINT products_review_count_non_neg CHECK (review_count >= 0),
    CONSTRAINT products_total_sold_non_neg   CHECK (total_sold >= 0)
);

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: product_variants
-- Req 3.3.2: Product Variants — Separate SKU, stock, price per variant
-- Req 3.2.3: Price, discount price, stock availability, SKU, product variants
-- Req 3.3.4: Manage stock, Low stock notifications
-- ---------------------------------------------------------------------------
CREATE TABLE product_variants (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id              UUID            NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Req 3.3.2: Separate SKU per variant
    sku                     VARCHAR(100)    NOT NULL UNIQUE,

    -- Req 3.2.3: Price, discount price
    price                   DECIMAL(12,2)   NOT NULL,
    discount_price          DECIMAL(12,2),

    -- Req 3.3.2: Separate stock per variant  Req 3.3.4: Stock alerts
    stock_qty               INTEGER         NOT NULL DEFAULT 0,
    low_stock_threshold     INTEGER         NOT NULL DEFAULT 5,

    -- Req 3.3.2: Weight & dimensions
    weight_kg               DECIMAL(8,3)    NOT NULL DEFAULT 0.000,
    length_cm               DECIMAL(8,2),
    width_cm                DECIMAL(8,2),
    height_cm               DECIMAL(8,2),

    -- Flags
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    is_default              BOOLEAN         NOT NULL DEFAULT FALSE,

    created_at              TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT variant_price_positive           CHECK (price > 0),
    CONSTRAINT variant_discount_less_than_price CHECK (discount_price IS NULL OR discount_price < price),
    CONSTRAINT variant_stock_non_negative       CHECK (stock_qty >= 0),
    CONSTRAINT variant_low_stock_non_negative   CHECK (low_stock_threshold >= 0),
    CONSTRAINT variant_weight_non_negative      CHECK (weight_kg >= 0)
);

CREATE TRIGGER trg_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: product_attribute_values (3-way pivot)
-- Req 3.3.2: Variant attributes (size, color, etc.) — defines the variant matrix
-- e.g., variant XYZ has Size=XL and Color=Red
-- ---------------------------------------------------------------------------
CREATE TABLE product_attribute_values (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id          UUID    NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    attribute_id        UUID    NOT NULL REFERENCES product_attributes(id) ON DELETE RESTRICT,
    attribute_value_id  UUID    NOT NULL REFERENCES attribute_values(id) ON DELETE RESTRICT,

    -- Each variant can only have one value per attribute
    CONSTRAINT pav_variant_attr_unique UNIQUE (variant_id, attribute_id)
);

-- ---------------------------------------------------------------------------
-- TABLE: product_images
-- Req 3.2.3: Images (multiple)
-- Req 3.3.2: Images (multiple)
-- ---------------------------------------------------------------------------
CREATE TABLE product_images (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url             TEXT        NOT NULL,
    alt_text        VARCHAR(255),
    is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,
    sort_order      SMALLINT    NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: product_tags
-- Req 3.3.2: Product Fields — Tags
-- Used for search indexing and related product discovery
-- ---------------------------------------------------------------------------
CREATE TABLE product_tags (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag         VARCHAR(100)    NOT NULL,

    CONSTRAINT product_tags_unique UNIQUE (product_id, tag),
    CONSTRAINT tag_not_empty CHECK (LENGTH(TRIM(tag)) > 0)
);

-- ---------------------------------------------------------------------------
-- TABLE: stock_history
-- Req 3.3.4: Stock history
-- Append-only audit log — never update or delete rows
-- ---------------------------------------------------------------------------
CREATE TABLE stock_history (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id      UUID            NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    changed_by      UUID            REFERENCES users(id) ON DELETE SET NULL,

    qty_before      INTEGER         NOT NULL,
    qty_change      INTEGER         NOT NULL,   -- positive = added, negative = removed
    qty_after       INTEGER         NOT NULL,

    reason          stock_reason    NOT NULL,
    -- reference_id points to the order_id, return_id, etc. that caused the change
    reference_id    UUID,
    note            TEXT,

    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT stock_history_qty_after_check CHECK (qty_after = qty_before + qty_change)
);

-- Prevent any UPDATE or DELETE on stock_history (immutable ledger)
CREATE RULE stock_history_no_update AS ON UPDATE TO stock_history DO INSTEAD NOTHING;
CREATE RULE stock_history_no_delete AS ON DELETE TO stock_history DO INSTEAD NOTHING;

-- =============================================================================
-- END OF MIGRATION 004
-- =============================================================================
