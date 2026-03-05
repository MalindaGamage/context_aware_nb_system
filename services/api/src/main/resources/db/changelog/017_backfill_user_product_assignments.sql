INSERT INTO user_product_assignments (id, user_id, product_id, assigned_by_user_id, starts_on, ends_on, created_at)
SELECT
  (
    SUBSTRING(md5(ur.user_id::text || p.id::text || 'seed-assignment'), 1, 8) || '-' ||
    SUBSTRING(md5(ur.user_id::text || p.id::text || 'seed-assignment'), 9, 4) || '-' ||
    SUBSTRING(md5(ur.user_id::text || p.id::text || 'seed-assignment'), 13, 4) || '-' ||
    SUBSTRING(md5(ur.user_id::text || p.id::text || 'seed-assignment'), 17, 4) || '-' ||
    SUBSTRING(md5(ur.user_id::text || p.id::text || 'seed-assignment'), 21, 12)
  )::uuid AS id,
  ur.user_id,
  p.id AS product_id,
  (SELECT id FROM users WHERE email = 'manager1@example.com' LIMIT 1) AS assigned_by_user_id,
  CURRENT_DATE - 30 AS starts_on,
  NULL::date AS ends_on,
  NOW() AS created_at
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
JOIN products p ON p.is_active = TRUE
WHERE r.name IN ('MR', 'SALES_REP')
  AND NOT EXISTS (
    SELECT 1
    FROM user_product_assignments upa
    WHERE upa.user_id = ur.user_id
      AND upa.product_id = p.id
      AND upa.starts_on <= CURRENT_DATE
      AND (upa.ends_on IS NULL OR upa.ends_on >= CURRENT_DATE)
  );
