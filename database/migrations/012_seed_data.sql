-- =============================================================================
-- MIGRATION 012: Essential Seed Data
-- Depends on: 001 through 011
-- Seeds: admin user, categories, product attributes, static pages,
--        shipping zones — everything needed for Day 1 operation
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ADMIN USER
-- Password: Admin@123456 (CHANGE IMMEDIATELY IN PRODUCTION)
-- Using pgcrypto crypt() with blowfish hashing
-- ---------------------------------------------------------------------------
INSERT INTO users (
    id, email, phone, password_hash, role,
    email_verified, is_active, first_name, last_name
) VALUES (
    uuid_generate_v4(),
    'admin@marketplace.et',
    '+251911000000',
    crypt('Admin@123456', gen_salt('bf', 12)),
    'admin',
    TRUE, TRUE, 'Platform', 'Admin'
) ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ROOT CATEGORIES
-- Req 3.2.2: Browse by categories, Browse by subcategories
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, parent_id, name, slug, sort_order, is_active) VALUES
    ('11111111-0000-0000-0000-000000000001', NULL, 'Electronics',         'electronics',         1,  TRUE),
    ('11111111-0000-0000-0000-000000000002', NULL, 'Fashion',             'fashion',             2,  TRUE),
    ('11111111-0000-0000-0000-000000000003', NULL, 'Home & Garden',       'home-garden',         3,  TRUE),
    ('11111111-0000-0000-0000-000000000004', NULL, 'Health & Beauty',     'health-beauty',       4,  TRUE),
    ('11111111-0000-0000-0000-000000000005', NULL, 'Sports & Outdoors',   'sports-outdoors',     5,  TRUE),
    ('11111111-0000-0000-0000-000000000006', NULL, 'Books & Education',   'books-education',     6,  TRUE),
    ('11111111-0000-0000-0000-000000000007', NULL, 'Groceries & Food',    'groceries-food',      7,  TRUE),
    ('11111111-0000-0000-0000-000000000008', NULL, 'Automotive',          'automotive',          8,  TRUE),
    ('11111111-0000-0000-0000-000000000009', NULL, 'Toys & Kids',         'toys-kids',           9,  TRUE),
    ('11111111-0000-0000-0000-000000000010', NULL, 'Office & Stationery', 'office-stationery',   10, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- SUBCATEGORIES — Electronics
INSERT INTO categories (id, parent_id, name, slug, sort_order, is_active) VALUES
    ('11111111-0001-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Smartphones',      'smartphones',        1, TRUE),
    ('11111111-0001-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Laptops',          'laptops',            2, TRUE),
    ('11111111-0001-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'TVs & Displays',   'tvs-displays',       3, TRUE),
    ('11111111-0001-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'Audio',            'audio',              4, TRUE),
    ('11111111-0001-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'Cameras',          'cameras',            5, TRUE),
    ('11111111-0001-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', 'Accessories',      'electronics-accessories', 6, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- SUBCATEGORIES — Fashion
INSERT INTO categories (id, parent_id, name, slug, sort_order, is_active) VALUES
    ('11111111-0002-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Men''s Clothing',  'mens-clothing',      1, TRUE),
    ('11111111-0002-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Women''s Clothing','womens-clothing',    2, TRUE),
    ('11111111-0002-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', 'Kids Clothing',    'kids-clothing',      3, TRUE),
    ('11111111-0002-0000-0000-000000000004', '11111111-0000-0000-0000-000000000002', 'Shoes',            'shoes',              4, TRUE),
    ('11111111-0002-0000-0000-000000000005', '11111111-0000-0000-0000-000000000002', 'Bags & Luggage',   'bags-luggage',       5, TRUE),
    ('11111111-0002-0000-0000-000000000006', '11111111-0000-0000-0000-000000000002', 'Jewelry',          'jewelry',            6, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PRODUCT ATTRIBUTES
-- Req 3.4.4: Manage product attributes
-- Req 3.2.2: Filter by Attributes (size, color, etc.)
-- ---------------------------------------------------------------------------
INSERT INTO product_attributes (id, name, display_name, input_type, sort_order) VALUES
    ('22222222-0000-0000-0000-000000000001', 'size',     'Size',     'button_group',  1),
    ('22222222-0000-0000-0000-000000000002', 'color',    'Color',    'color_swatch',  2),
    ('22222222-0000-0000-0000-000000000003', 'material', 'Material', 'select',        3),
    ('22222222-0000-0000-0000-000000000004', 'storage',  'Storage',  'button_group',  4),
    ('22222222-0000-0000-0000-000000000005', 'ram',      'RAM',      'button_group',  5),
    ('22222222-0000-0000-0000-000000000006', 'weight',   'Weight',   'select',        6)
ON CONFLICT (name) DO NOTHING;

-- Attribute values — Size
INSERT INTO attribute_values (id, attribute_id, value, display_value, sort_order) VALUES
    ('33333333-0001-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'xs',  'XS',  1),
    ('33333333-0001-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 's',   'S',   2),
    ('33333333-0001-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 'm',   'M',   3),
    ('33333333-0001-0000-0000-000000000004', '22222222-0000-0000-0000-000000000001', 'l',   'L',   4),
    ('33333333-0001-0000-0000-000000000005', '22222222-0000-0000-0000-000000000001', 'xl',  'XL',  5),
    ('33333333-0001-0000-0000-000000000006', '22222222-0000-0000-0000-000000000001', 'xxl', 'XXL', 6),
    ('33333333-0001-0000-0000-000000000007', '22222222-0000-0000-0000-000000000001', 'xxxl','XXXL',7)
ON CONFLICT (attribute_id, value) DO NOTHING;

-- Attribute values — Color
INSERT INTO attribute_values (id, attribute_id, value, display_value, color_hex, sort_order) VALUES
    ('33333333-0002-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'black',  'Black',  '#000000', 1),
    ('33333333-0002-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'white',  'White',  '#FFFFFF', 2),
    ('33333333-0002-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002', 'red',    'Red',    '#E53E3E', 3),
    ('33333333-0002-0000-0000-000000000004', '22222222-0000-0000-0000-000000000002', 'blue',   'Blue',   '#3182CE', 4),
    ('33333333-0002-0000-0000-000000000005', '22222222-0000-0000-0000-000000000002', 'green',  'Green',  '#38A169', 5),
    ('33333333-0002-0000-0000-000000000006', '22222222-0000-0000-0000-000000000002', 'yellow', 'Yellow', '#ECC94B', 6),
    ('33333333-0002-0000-0000-000000000007', '22222222-0000-0000-0000-000000000002', 'gray',   'Gray',   '#718096', 7),
    ('33333333-0002-0000-0000-000000000008', '22222222-0000-0000-0000-000000000002', 'brown',  'Brown',  '#92400E', 8)
ON CONFLICT (attribute_id, value) DO NOTHING;

-- Attribute values — Storage
INSERT INTO attribute_values (id, attribute_id, value, display_value, sort_order) VALUES
    ('33333333-0004-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004', '64gb',  '64 GB',  1),
    ('33333333-0004-0000-0000-000000000002', '22222222-0000-0000-0000-000000000004', '128gb', '128 GB', 2),
    ('33333333-0004-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004', '256gb', '256 GB', 3),
    ('33333333-0004-0000-0000-000000000004', '22222222-0000-0000-0000-000000000004', '512gb', '512 GB', 4),
    ('33333333-0004-0000-0000-000000000005', '22222222-0000-0000-0000-000000000004', '1tb',   '1 TB',   5)
ON CONFLICT (attribute_id, value) DO NOTHING;

-- Attribute values — RAM
INSERT INTO attribute_values (id, attribute_id, value, display_value, sort_order) VALUES
    ('33333333-0005-0000-0000-000000000001', '22222222-0000-0000-0000-000000000005', '4gb',  '4 GB',  1),
    ('33333333-0005-0000-0000-000000000002', '22222222-0000-0000-0000-000000000005', '8gb',  '8 GB',  2),
    ('33333333-0005-0000-0000-000000000003', '22222222-0000-0000-0000-000000000005', '16gb', '16 GB', 3),
    ('33333333-0005-0000-0000-000000000004', '22222222-0000-0000-0000-000000000005', '32gb', '32 GB', 4)
ON CONFLICT (attribute_id, value) DO NOTHING;

-- ---------------------------------------------------------------------------
-- SHIPPING ZONES
-- Req 3.7: Shipping zone configuration, Shipping rate rules
-- ---------------------------------------------------------------------------
INSERT INTO shipping_zones (id, name, regions, base_rate, per_kg_rate, free_above_amount, estimated_days_min, estimated_days_max) VALUES
    (uuid_generate_v4(), 'Addis Ababa', '["Addis Ababa"]',              50.00,  5.00,  500.00,  1, 2),
    (uuid_generate_v4(), 'Nearby Cities', '["Adama","Bishoftu","Shashamane","Debre Birhan"]', 80.00, 8.00, 800.00, 2, 4),
    (uuid_generate_v4(), 'Oromia Region', '["Jimma","Dire Dawa","Harar","Asella","Nekemte"]', 120.00, 12.00, 1200.00, 3, 6),
    (uuid_generate_v4(), 'National',      '[]',                          180.00, 18.00, 2000.00, 5, 10)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- STATIC PAGES
-- Req 3.4.7: Manage static pages
-- ---------------------------------------------------------------------------
INSERT INTO static_pages (slug, title, content_html, meta_title) VALUES
    ('about-us',       'About Us',        '<h1>About Us</h1><p>Welcome to our marketplace.</p>',                           'About Us'),
    ('contact',        'Contact Us',      '<h1>Contact Us</h1><p>Reach us at support@marketplace.et</p>',                  'Contact Us'),
    ('privacy-policy', 'Privacy Policy',  '<h1>Privacy Policy</h1><p>Your privacy matters to us.</p>',                     'Privacy Policy'),
    ('terms',          'Terms & Conditions','<h1>Terms & Conditions</h1><p>By using our platform you agree to these terms.</p>', 'Terms & Conditions'),
    ('faq',            'FAQ',             '<h1>Frequently Asked Questions</h1><p>Coming soon.</p>',                         'FAQ')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- END OF MIGRATION 012
-- =============================================================================
