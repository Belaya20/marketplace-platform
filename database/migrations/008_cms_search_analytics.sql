-- =============================================================================
-- MIGRATION 008: CMS, Search & Analytics
-- Depends on: 001, 002
-- Covers requirements: 3.4.7 CMS (Content Management), 3.6 Search System,
--   3.4.8 Reports & Analytics
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: banner_items
-- Req 3.4.7: Manage homepage banners
-- Req 3.2.1: Promotional banners (home page)
-- Supports scheduled campaigns (starts_at / ends_at)
-- ---------------------------------------------------------------------------
CREATE TABLE banner_items (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by      UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    title           VARCHAR(255)    NOT NULL,
    subtitle        VARCHAR(500),
    image_url       TEXT            NOT NULL,
    mobile_image_url TEXT,               -- responsive version for mobile
    link_url        TEXT,
    link_target     VARCHAR(10)     NOT NULL DEFAULT '_self',  -- '_self' or '_blank'
    cta_text        VARCHAR(100),        -- button label e.g. "Shop Now"

    sort_order      SMALLINT        NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Scheduled visibility (Req 3.4.7: manage banners for campaigns)
    starts_at       TIMESTAMP WITH TIME ZONE,
    ends_at         TIMESTAMP WITH TIME ZONE,

    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT banner_link_target_valid CHECK (link_target IN ('_self', '_blank')),
    CONSTRAINT banner_dates_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TRIGGER trg_banner_items_updated_at
    BEFORE UPDATE ON banner_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: static_pages
-- Req 3.4.7: Manage static pages — About Us, Contact, Privacy Policy,
--             Terms & Conditions
-- ---------------------------------------------------------------------------
CREATE TABLE static_pages (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            VARCHAR(100)    NOT NULL UNIQUE,    -- 'about-us', 'privacy-policy'
    title           VARCHAR(255)    NOT NULL,
    content_html    TEXT            NOT NULL DEFAULT '',
    meta_title      VARCHAR(255),
    meta_description VARCHAR(500),
    is_published    BOOLEAN         NOT NULL DEFAULT TRUE,
    updated_by      UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_static_pages_updated_at
    BEFORE UPDATE ON static_pages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: blog_posts
-- Req 3.4.7: Blog management (optional)
-- ---------------------------------------------------------------------------
CREATE TABLE blog_posts (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id           UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_slug       VARCHAR(100),

    title               VARCHAR(500)    NOT NULL,
    slug                VARCHAR(550)    NOT NULL UNIQUE,
    excerpt             TEXT,
    content_html        TEXT            NOT NULL DEFAULT '',
    cover_image_url     TEXT,

    status              blog_status     NOT NULL DEFAULT 'draft',
    meta_title          VARCHAR(255),
    meta_description    VARCHAR(500),
    tags                JSONB           NOT NULL DEFAULT '[]',

    view_count          INTEGER         NOT NULL DEFAULT 0,
    published_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: search_logs
-- Req 3.6: Keyword search, Auto-suggestion
-- Logged queries power the autocomplete engine (top recent queries)
-- ---------------------------------------------------------------------------
CREATE TABLE search_logs (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,  -- NULL for guests
    query           VARCHAR(500)    NOT NULL,
    results_count   INTEGER         NOT NULL DEFAULT 0,
    selected_product_id UUID        REFERENCES products(id) ON DELETE SET NULL,
    ip_address      INET,
    user_agent      TEXT,
    searched_at     TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT search_query_not_empty CHECK (LENGTH(TRIM(query)) > 0)
);

-- ---------------------------------------------------------------------------
-- TABLE: report_exports
-- Req 3.4.8: Export reports (PDF/Excel)
-- Async generation — worker picks up 'queued' rows and sets 'ready' + file_url
-- ---------------------------------------------------------------------------
CREATE TABLE report_exports (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_by    UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    report_type     report_type     NOT NULL,
    format          export_format   NOT NULL DEFAULT 'excel',
    filters         JSONB           NOT NULL DEFAULT '{}',  -- date range, seller_id, etc.

    status          export_status   NOT NULL DEFAULT 'queued',
    file_url        TEXT,
    error_message   TEXT,
    row_count       INTEGER,

    requested_at    TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMP WITH TIME ZONE,
    ready_at        TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- END OF MIGRATION 008
-- =============================================================================
