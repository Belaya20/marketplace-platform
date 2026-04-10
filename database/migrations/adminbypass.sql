-- Create admin user (password: Admin123!)
INSERT INTO users (
  id, email, password_hash, role,
  first_name, last_name,
  email_verified, is_active, is_suspended
)
VALUES (
  gen_random_uuid(),
  'admin@marketplace.et',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBVzCCMFQOSWOi',
  'admin',
  'Admin', 'User',
  true, true, false
)
ON CONFLICT (email) DO UPDATE
  SET email_verified = true,
      is_active      = true,
      role           = 'admin'
RETURNING id, email, role, email_verified;