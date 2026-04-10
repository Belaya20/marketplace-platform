SELECT 
  u.email,
  u.first_name,
  o.token,
  o.purpose,
  o.expires_at,
  o.is_used,
  o.created_at
FROM otp_tokens o
JOIN users u ON u.id = o.user_id
WHERE o.is_used = false
  AND o.expires_at > NOW()
ORDER BY o.created_at DESC
LIMIT 5;