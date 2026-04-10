UPDATE users
SET password_hash = '$2b$12$ml20xX/lIS3vSsW5K0KYE.1J8f3pIPl52vsJl.xnh5VaKTKY.n.h2'
WHERE email = 'admin@marketplace.et'
RETURNING email, role, email_verified;