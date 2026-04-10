-- =============================================================================
-- MIGRATION 011: Row Level Security (RLS) Policies
-- Depends on: 001 through 010
-- Req 4.2: Role-based access control
-- These policies enforce data isolation at the database level —
-- even if the API layer has a bug, sellers cannot see each other's data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on sensitive tables
-- ---------------------------------------------------------------------------
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists               ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_exports          ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- DATABASE ROLES
-- The API connects as one of three roles. Admin role bypasses RLS.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ecom_customer') THEN
        CREATE ROLE ecom_customer NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ecom_seller') THEN
        CREATE ROLE ecom_seller NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ecom_admin') THEN
        CREATE ROLE ecom_admin NOLOGIN BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ecom_api') THEN
        CREATE ROLE ecom_api LOGIN PASSWORD 'CHANGE_IN_PRODUCTION';
    END IF;
END $$;

GRANT ecom_customer TO ecom_api;
GRANT ecom_seller   TO ecom_api;
GRANT ecom_admin    TO ecom_api;

-- ---------------------------------------------------------------------------
-- TABLE GRANTS
-- ---------------------------------------------------------------------------
-- Public read (product catalogue, categories, brands, banners)
GRANT SELECT ON categories, brands, product_attributes, attribute_values,
               products, product_variants, product_attribute_values,
               product_images, product_tags, flash_sales, flash_sale_items,
               shipping_zones, banner_items, static_pages, blog_posts,
               reviews TO ecom_customer, ecom_seller;

-- Customer-specific
GRANT SELECT, INSERT, UPDATE, DELETE ON
    cart_items, wishlists, user_addresses, otp_tokens TO ecom_customer;
GRANT SELECT, INSERT ON orders, order_items, payments TO ecom_customer;
GRANT SELECT, INSERT ON returns, reviews, notifications TO ecom_customer;
GRANT SELECT ON discount_rules TO ecom_customer;

-- Seller-specific
GRANT SELECT, INSERT, UPDATE, DELETE ON
    products, product_variants, product_attribute_values,
    product_images, product_tags TO ecom_seller;
GRANT SELECT, UPDATE ON order_items TO ecom_seller;
GRANT SELECT ON orders TO ecom_seller;
GRANT SELECT, INSERT ON wallet_transactions, withdrawal_requests TO ecom_seller;
GRANT SELECT ON stock_history TO ecom_seller;

-- Admin gets everything
GRANT ALL ON ALL TABLES IN SCHEMA public TO ecom_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ecom_admin;

-- ---------------------------------------------------------------------------
-- RLS POLICIES: users
-- Users can only see/edit their own row; admins see all (BYPASSRLS)
-- ---------------------------------------------------------------------------
CREATE POLICY users_own_row ON users
    FOR ALL TO ecom_customer, ecom_seller
    USING (id = current_setting('app.current_user_id', TRUE)::UUID);

-- ---------------------------------------------------------------------------
-- RLS POLICIES: otp_tokens
-- ---------------------------------------------------------------------------
CREATE POLICY otp_own ON otp_tokens
    FOR ALL TO ecom_customer, ecom_seller
    USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- ---------------------------------------------------------------------------
-- RLS POLICIES: user_addresses
-- ---------------------------------------------------------------------------
CREATE POLICY addresses_own ON user_addresses
    FOR ALL TO ecom_customer, ecom_seller
    USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- ---------------------------------------------------------------------------
-- RLS POLICIES: seller_profiles
-- Sellers see only their own profile
-- ---------------------------------------------------------------------------
CREATE POLICY seller_profiles_own ON seller_profiles
    FOR ALL TO ecom_seller
    USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- ---------------------------------------------------------------------------
-- RLS POLICIES: seller_documents
-- ---------------------------------------------------------------------------
CREATE POLICY seller_docs_own ON seller_documents
    FOR ALL TO ecom_seller
    USING (seller_id = (
        SELECT id FROM seller_profiles
        WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
    ));

-- ---------------------------------------------------------------------------
-- RLS POLICIES: products
-- Sellers see only their own products; customers see only active products
-- ---------------------------------------------------------------------------
CREATE POLICY products_customer_read ON products
    FOR SELECT TO ecom_customer
    USING (status = 'active');

CREATE POLICY products_seller_own ON products
    FOR ALL TO ecom_seller
    USING (seller_id = (
        SELECT id FROM seller_profiles
        WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
    ));

-- ---------------------------------------------------------------------------
-- RLS POLICIES: product_variants
-- ---------------------------------------------------------------------------
CREATE POLICY variants_customer_read ON product_variants
    FOR SELECT TO ecom_customer
    USING (
        is_active = TRUE AND EXISTS (
            SELECT 1 FROM products WHERE id = product_id AND status = 'active'
        )
    );

CREATE POLICY variants_seller_own ON product_variants
    FOR ALL TO ecom_seller
    USING (
        product_id IN (
            SELECT id FROM products
            WHERE seller_id = (
                SELECT id FROM seller_profiles
                WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
            )
        )
    );

-- ---------------------------------------------------------------------------
-- RLS POLICIES: cart_items
-- ---------------------------------------------------------------------------
CREATE POLICY cart_own ON cart_items
    FOR ALL TO ecom_customer
    USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- ---------------------------------------------------------------------------
-- RLS POLICIES: wishlists
-- ---------------------------------------------------------------------------
CREATE POLICY wishlist_own ON wishlists
    FOR ALL TO ecom_customer
    USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- ---------------------------------------------------------------------------
-- RLS POLICIES: orders
-- Customers see their own orders; sellers see orders containing their items
-- ---------------------------------------------------------------------------
CREATE POLICY orders_customer_own ON orders
    FOR SELECT TO ecom_customer
    USING (customer_id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY orders_seller_view ON orders
    FOR SELECT TO ecom_seller
    USING (id IN (
        SELECT order_id FROM order_items
        WHERE seller_id = (
            SELECT id FROM seller_profiles
            WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
        )
    ));

-- ---------------------------------------------------------------------------
-- RLS POLICIES: order_items
-- ---------------------------------------------------------------------------
CREATE POLICY order_items_seller_own ON order_items
    FOR SELECT, UPDATE TO ecom_seller
    USING (seller_id = (
        SELECT id FROM seller_profiles
        WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
    ));

-- ---------------------------------------------------------------------------
-- RLS POLICIES: returns
-- ---------------------------------------------------------------------------
CREATE POLICY returns_customer_own ON returns
    FOR SELECT, INSERT TO ecom_customer
    USING (customer_id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY returns_seller_own ON returns
    FOR SELECT, UPDATE TO ecom_seller
    USING (seller_id = (
        SELECT id FROM seller_profiles
        WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
    ));

-- ---------------------------------------------------------------------------
-- RLS POLICIES: wallet_transactions
-- ---------------------------------------------------------------------------
CREATE POLICY wallet_tx_seller_own ON wallet_transactions
    FOR SELECT TO ecom_seller
    USING (seller_id = (
        SELECT id FROM seller_profiles
        WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
    ));

-- ---------------------------------------------------------------------------
-- RLS POLICIES: withdrawal_requests
-- ---------------------------------------------------------------------------
CREATE POLICY withdrawal_seller_own ON withdrawal_requests
    FOR ALL TO ecom_seller
    USING (seller_id = (
        SELECT id FROM seller_profiles
        WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
    ));

-- ---------------------------------------------------------------------------
-- RLS POLICIES: notifications
-- ---------------------------------------------------------------------------
CREATE POLICY notifications_own ON notifications
    FOR ALL TO ecom_customer, ecom_seller
    USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- ---------------------------------------------------------------------------
-- RLS POLICIES: report_exports
-- ---------------------------------------------------------------------------
CREATE POLICY report_exports_own ON report_exports
    FOR ALL TO ecom_seller
    USING (requested_by = current_setting('app.current_user_id', TRUE)::UUID);

-- =============================================================================
-- END OF MIGRATION 011
-- =============================================================================
