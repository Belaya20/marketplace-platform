-- =============================================================================
-- MIGRATION 003: Catalogue Tables
-- Depends on: 001, 002
-- Covers requirements: 3.4.3 Category Management, 3.4.4 Product Attributes & Brands
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: categories
-- Req 3.2.2: Browse by categories, Browse by subcategories
-- Req 3.4.3: Create category, Create subcategory, Edit/delete category,
--            Manage category hierarchy
-- Self-referential for unlimited depth: Category → Subcategory → deeper
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id       UUID        REFERENCES categories(id) ON DELETE SET NULL,

    name            VARCHAR(150)    NOT NULL,
    slug            VARCHAR(180)    NOT NULL UNIQUE,
    description     TEXT,
    image_url       TEXT,
    meta_title      VARCHAR(255),
    meta_description TEXT,

    sort_order      SMALLINT        NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT categories_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT categories_no_self_parent CHECK (id <> parent_id)
);

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: brands
-- Req 3.2.2: Filter by Brand
-- Req 3.3.2: Product Fields — Brand
-- Req 3.4.4: Manage brands
-- ---------------------------------------------------------------------------
CREATE TABLE brands (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150)    NOT NULL UNIQUE,
    slug            VARCHAR(180)    NOT NULL UNIQUE,
    description     TEXT,
    logo_url        TEXT,
    website_url     TEXT,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_brands_updated_at
    BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: product_attributes
-- Req 3.4.4: Manage product attributes
-- Req 3.2.2: Filter by Attributes (size, color, etc.)
-- Req 3.3.2: Variant attributes (size, color, etc.)
-- Admin-managed registry of all possible attribute types
-- ---------------------------------------------------------------------------
CREATE TABLE product_attributes (
    id              UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100)            NOT NULL UNIQUE,   -- internal: "size"
    display_name    VARCHAR(100)            NOT NULL,           -- shown: "Size"
    input_type      attribute_input_type    NOT NULL DEFAULT 'select',
    is_required     BOOLEAN                 NOT NULL DEFAULT FALSE,
    sort_order      SMALLINT                NOT NULL DEFAULT 0,
    is_active       BOOLEAN                 NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: attribute_values
-- Req 3.4.4: Manage product attributes (their valid option values)
-- e.g., attribute_id → "size", value → "XL", display_value → "Extra Large"
-- ---------------------------------------------------------------------------
CREATE TABLE attribute_values (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_id    UUID        NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,
    value           VARCHAR(100)    NOT NULL,           -- internal key: "xl"
    display_value   VARCHAR(100)    NOT NULL,           -- shown label: "XL"
    color_hex       VARCHAR(7),                         -- only for color_swatch type
    sort_order      SMALLINT        NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,

    CONSTRAINT attribute_values_unique_per_attr UNIQUE (attribute_id, value),
    CONSTRAINT color_hex_format CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$')
);

-- ---------------------------------------------------------------------------
-- TABLE: shipping_zones
-- Req 3.7: Shipping zone configuration, Shipping rate rules, Weight-based shipping
-- ---------------------------------------------------------------------------
CREATE TABLE shipping_zones (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(150)    NOT NULL,
    -- regions is an array of city/region names this zone covers
    regions             JSONB           NOT NULL DEFAULT '[]',
    base_rate           DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    per_kg_rate         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    -- free shipping above this order total (0 = never free)
    free_above_amount   DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    estimated_days_min  SMALLINT        NOT NULL DEFAULT 1,
    estimated_days_max  SMALLINT        NOT NULL DEFAULT 7,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT shipping_base_rate_non_neg CHECK (base_rate >= 0),
    CONSTRAINT shipping_per_kg_non_neg    CHECK (per_kg_rate >= 0),
    CONSTRAINT shipping_days_order        CHECK (estimated_days_min <= estimated_days_max)
);

CREATE TRIGGER trg_shipping_zones_updated_at
    BEFORE UPDATE ON shipping_zones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- END OF MIGRATION 003
-- =============================================================================
