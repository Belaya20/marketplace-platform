-- Step 2a: Create seller user (password: Seller123!)
INSERT INTO users (
  id, email, password_hash, role,
  first_name, last_name,
  email_verified, is_active, is_suspended
)
VALUES (
  gen_random_uuid(),
  'seller@marketplace.et',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uArpHXOde',
  'seller',
  'Test', 'Seller',
  true, true, false
)
ON CONFLICT (email) DO UPDATE
  SET email_verified = true,
      is_active      = true,
      role           = 'seller'
RETURNING id, email, role, email_verified;