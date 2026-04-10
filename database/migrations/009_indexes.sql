-- =============================================================================
-- MIGRATION 009: Production Indexes
-- Depends on: 001 through 008
-- Every index is justified by a specific query pattern from the requirements.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
-- Req 3.1.2: Secure login — lookup by email
CREATE INDEX idx_users_email         ON users(email);
-- Req 3.1.1: Phone-based registration
CREATE INDEX idx_users_phone         ON users(phone) WHERE phone IS NOT NULL;
-- Req 3.4.2: List users by role (admin filtering)
CREATE INDEX idx_users_role          ON users(role);
-- Req 3.4.2: Suspend/activate — filter active users
CREATE INDEX idx_users_is_active     ON users(is_active);

-- ---------------------------------------------------------------------------
-- OTP TOKENS
-- ---------------------------------------------------------------------------
-- Req 3.1.1: Verify OTP — lookup by user + purpose + token
CREATE INDEX idx_otp_user_purpose    ON otp_tokens(user_id, purpose);
-- Expire cleanup job
CREATE INDEX idx_otp_expires_at      ON otp_tokens(expires_at) WHERE is_used = FALSE;

-- ---------------------------------------------------------------------------
-- SELLER PROFILES
-- ---------------------------------------------------------------------------
-- Req 3.4.2: Sellers awaiting approval
CREATE INDEX idx_seller_status       ON seller_profiles(status);
-- Store URL lookup
CREATE INDEX idx_seller_store_slug   ON seller_profiles(store_slug) WHERE store_slug IS NOT NULL;

-- ---------------------------------------------------------------------------
-- CATEGORIES
-- ---------------------------------------------------------------------------
-- Req 3.2.2: Browse by categories — slug lookup (public page)
CREATE INDEX idx_categories_slug         ON categories(slug);
-- Req 3.4.3: Manage category hierarchy — find children
CREATE INDEX idx_categories_parent_id    ON categories(parent_id) WHERE parent_id IS NOT NULL;
-- Active storefront categories
CREATE INDEX idx_categories_active       ON categories(is_active, sort_order);

-- ---------------------------------------------------------------------------
-- BRANDS
-- ---------------------------------------------------------------------------
CREATE INDEX idx_brands_slug        ON brands(slug);
CREATE INDEX idx_brands_is_active   ON brands(is_active);

-- ---------------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------------
-- Req 3.2.2: Browse by categories (most common storefront query)
CREATE INDEX idx_products_category_status   ON products(category_id, status);
-- Req 3.2.2: Filter by brand
CREATE INDEX idx_products_brand_status      ON products(brand_id, status) WHERE brand_id IS NOT NULL;
-- Seller's own product list (Req 3.3.2)
CREATE INDEX idx_products_seller_status     ON products(seller_id, status);
-- Req 3.4.4: Approve seller products — pending_review queue
CREATE INDEX idx_products_pending           ON products(status) WHERE status = 'pending_review';
-- Req 3.4.4: Feature products — homepage
CREATE INDEX idx_products_featured          ON products(is_featured, status) WHERE is_featured = TRUE;
-- Req 3.2.2: Sort by Rating
CREATE INDEX idx_products_avg_rating        ON products(avg_rating DESC, review_count DESC);
-- Req 3.2.2: Sort by Newest
CREATE INDEX idx_products_created_at        ON products(created_at DESC);
-- Req 3.2.1: Best sellers (home page)
CREATE INDEX idx_products_total_sold        ON products(total_sold DESC);
-- Req 3.6: Full-text keyword search on name + description (pg_trgm)
CREATE INDEX idx_products_name_trgm         ON products USING GIN (name gin_trgm_ops);
CREATE INDEX idx_products_desc_trgm         ON products USING GIN (full_description gin_trgm_ops);
-- Slug lookup for product detail page (Req 3.2.3)
CREATE INDEX idx_products_slug              ON products(slug);

-- ---------------------------------------------------------------------------
-- PRODUCT VARIANTS
-- ---------------------------------------------------------------------------
-- SKU lookup (Req 3.6: Search by SKU)
CREATE INDEX idx_variants_sku           ON product_variants(sku);
-- Product → variants (very frequent join)
CREATE INDEX idx_variants_product_id    ON product_variants(product_id);
-- Active variants only (storefront)
CREATE INDEX idx_variants_active        ON product_variants(product_id, is_active) WHERE is_active = TRUE;
-- Req 3.3.4: Low stock alerts — find variants below threshold
CREATE INDEX idx_variants_low_stock     ON product_variants(product_id)
    WHERE stock_qty <= low_stock_threshold AND is_active = TRUE;

-- ---------------------------------------------------------------------------
-- PRODUCT ATTRIBUTE VALUES
-- ---------------------------------------------------------------------------
-- Req 3.2.2: Filter by Attributes — find variants with a given attribute value
CREATE INDEX idx_pav_attribute_value    ON product_attribute_values(attribute_id, attribute_value_id);
CREATE INDEX idx_pav_variant_id         ON product_attribute_values(variant_id);

-- ---------------------------------------------------------------------------
-- PRODUCT IMAGES
-- ---------------------------------------------------------------------------
CREATE INDEX idx_images_product_primary ON product_images(product_id, is_primary);

-- ---------------------------------------------------------------------------
-- PRODUCT TAGS
-- ---------------------------------------------------------------------------
-- Req 3.6: Tag-based search
CREATE INDEX idx_product_tags_tag       ON product_tags(tag);
CREATE INDEX idx_product_tags_product   ON product_tags(product_id);

-- ---------------------------------------------------------------------------
-- STOCK HISTORY
-- ---------------------------------------------------------------------------
-- Req 3.3.4: Stock history per variant
CREATE INDEX idx_stock_history_variant  ON stock_history(variant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- CART ITEMS
-- ---------------------------------------------------------------------------
-- Req 3.2.4: Get cart for user (most frequent cart operation)
CREATE INDEX idx_cart_user_id           ON cart_items(user_id);
-- Cleanup: find all carts containing a variant (e.g. when variant goes out of stock)
CREATE INDEX idx_cart_variant_id        ON cart_items(variant_id);

-- ---------------------------------------------------------------------------
-- WISHLISTS
-- ---------------------------------------------------------------------------
-- Req 3.2.8: Get wishlist for user
CREATE INDEX idx_wishlists_user_id      ON wishlists(user_id);

-- ---------------------------------------------------------------------------
-- FLASH SALES
-- ---------------------------------------------------------------------------
-- Req 3.2.1: Flash sales section — find currently active
CREATE INDEX idx_flash_sales_active     ON flash_sales(is_active, starts_at, ends_at);
CREATE INDEX idx_flash_sale_items_sale  ON flash_sale_items(flash_sale_id);
CREATE INDEX idx_flash_sale_items_variant ON flash_sale_items(variant_id);

-- ---------------------------------------------------------------------------
-- DISCOUNT RULES
-- ---------------------------------------------------------------------------
-- Code lookup for coupon application
CREATE INDEX idx_discount_code          ON discount_rules(code) WHERE is_active = TRUE;
CREATE INDEX idx_discount_seller        ON discount_rules(seller_id) WHERE seller_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------
-- Req 3.2.7: Customer order history
CREATE INDEX idx_orders_customer_id     ON orders(customer_id, placed_at DESC);
-- Req 3.4.5: Admin — all orders
CREATE INDEX idx_orders_status          ON orders(status, placed_at DESC);
-- Req 3.2.6: Payment lookup by Chapa tx_ref
CREATE INDEX idx_orders_chapa_tx_ref    ON orders(chapa_tx_ref) WHERE chapa_tx_ref IS NOT NULL;
-- Order number human lookup
CREATE INDEX idx_orders_order_number    ON orders(order_number);

-- ---------------------------------------------------------------------------
-- ORDER STATUS HISTORY
-- ---------------------------------------------------------------------------
-- Req 3.2.7: Track order status history (timeline view)
CREATE INDEX idx_osh_order_id           ON order_status_history(order_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- ORDER ITEMS
-- ---------------------------------------------------------------------------
-- Req 3.3.3: Seller incoming orders
CREATE INDEX idx_order_items_seller     ON order_items(seller_id, status, updated_at DESC);
-- Order → items join
CREATE INDEX idx_order_items_order_id   ON order_items(order_id);
-- Variant history (for analytics)
CREATE INDEX idx_order_items_variant    ON order_items(variant_id) WHERE variant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- PAYMENTS
-- ---------------------------------------------------------------------------
-- Req 3.2.6: Payment verification by tx_ref (Chapa callback)
CREATE INDEX idx_payments_chapa_ref     ON payments(chapa_tx_ref);
-- Req 3.4.6: Payment logs by order
CREATE INDEX idx_payments_order_id      ON payments(order_id);
-- Req 3.4.6: Payment logs monitoring by status
CREATE INDEX idx_payments_status        ON payments(status, initiated_at DESC);

-- ---------------------------------------------------------------------------
-- RETURNS
-- ---------------------------------------------------------------------------
-- Req 3.8: Return status tracking
CREATE INDEX idx_returns_order_item     ON returns(order_item_id);
CREATE INDEX idx_returns_customer       ON returns(customer_id);
CREATE INDEX idx_returns_seller         ON returns(seller_id, status);

-- ---------------------------------------------------------------------------
-- WALLET TRANSACTIONS
-- ---------------------------------------------------------------------------
-- Req 3.3.5: Seller earnings history
CREATE INDEX idx_wallet_tx_seller       ON wallet_transactions(seller_id, created_at DESC);
CREATE INDEX idx_wallet_tx_type         ON wallet_transactions(seller_id, type);

-- ---------------------------------------------------------------------------
-- WITHDRAWAL REQUESTS
-- ---------------------------------------------------------------------------
-- Req 3.3.5: Withdrawal history per seller
CREATE INDEX idx_withdrawal_seller      ON withdrawal_requests(seller_id, requested_at DESC);
-- Admin: pending approvals
CREATE INDEX idx_withdrawal_status      ON withdrawal_requests(status) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- REVIEWS
-- ---------------------------------------------------------------------------
-- Req 3.2.3: Product reviews on product detail page
CREATE INDEX idx_reviews_product        ON reviews(product_id, is_approved, created_at DESC);
-- Req 3.2.9: User's own reviews
CREATE INDEX idx_reviews_user           ON reviews(user_id);
-- Req 3.2.9: Reported reviews — admin moderation queue
CREATE INDEX idx_reviews_reported       ON reviews(is_reported) WHERE is_reported = TRUE;

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
-- Req 3.5: In-app notification inbox — unread count and listing
CREATE INDEX idx_notifications_user     ON notifications(user_id, is_read, created_at DESC);
-- Channel filter (for email/sms delivery workers)
CREATE INDEX idx_notifications_channel  ON notifications(channel, created_at DESC);

-- ---------------------------------------------------------------------------
-- BANNER ITEMS
-- ---------------------------------------------------------------------------
-- Req 3.2.1: Home page banners — active and sorted
CREATE INDEX idx_banners_active_sort    ON banner_items(is_active, sort_order, starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- SEARCH LOGS
-- ---------------------------------------------------------------------------
-- Req 3.6: Auto-suggestion — top recent queries
CREATE INDEX idx_search_logs_query      ON search_logs USING GIN (query gin_trgm_ops);
CREATE INDEX idx_search_logs_recent     ON search_logs(searched_at DESC);

-- =============================================================================
-- END OF MIGRATION 009
-- =============================================================================
