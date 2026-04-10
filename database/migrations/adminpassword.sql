-- Ensure pgcrypto is enabled for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert admin user only if it does NOT already exist
INSERT INTO users (
    id,
    email,
    password_hash,
    role,
    first_name,
    last_name,
    email_verified,
    is_active
)
SELECT
    gen_random_uuid(),
    'admin@marketplace.et',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBVzCCMFQOSWOi', -- password: Admin123!
    'admin',
    'Admin',
    'User',
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'admin@marketplace.et'
);
