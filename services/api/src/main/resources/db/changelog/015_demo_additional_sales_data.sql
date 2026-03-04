INSERT INTO pharmacy_orders (
  id, pharmacy_id, sales_rep_user_id, territory_id, ordered_at, notes, client_reference_id, created_at
)
SELECT
  (SUBSTRING(md5(o.client_reference_id), 1, 8) || '-' || SUBSTRING(md5(o.client_reference_id), 9, 4) || '-' || SUBSTRING(md5(o.client_reference_id), 13, 4) || '-' || SUBSTRING(md5(o.client_reference_id), 17, 4) || '-' || SUBSTRING(md5(o.client_reference_id), 21, 12))::uuid,
  o.pharmacy_id,
  '44444444-4444-4444-4444-444444444444'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  o.ordered_at,
  o.notes,
  o.client_reference_id,
  o.ordered_at
FROM (
  SELECT CASE WHEN gs % 2 = 0 THEN '66666666-6666-6666-6666-666666666663'::uuid ELSE '66666666-6666-6666-6666-666666666665'::uuid END AS pharmacy_id,
         NOW() - ((10 + gs) * INTERVAL '1 day') AS ordered_at,
         'CardioPlus booster order' AS notes,
         'demo-order-cardio-boost-' || gs AS client_reference_id
  FROM generate_series(1, 10) AS gs
  UNION ALL
  SELECT CASE WHEN gs % 2 = 0 THEN '66666666-6666-6666-6666-666666666664'::uuid ELSE '66666666-6666-6666-6666-666666666662'::uuid END,
         NOW() - ((70 + gs * 2) * INTERVAL '1 day'),
         'Older GlucoSure order',
         'demo-order-gluco-older-' || gs
  FROM generate_series(1, 10) AS gs
) AS o
WHERE NOT EXISTS (
  SELECT 1 FROM pharmacy_orders existing
  WHERE existing.sales_rep_user_id = '44444444-4444-4444-4444-444444444444'
    AND existing.client_reference_id = o.client_reference_id
);

INSERT INTO pharmacy_order_items (id, order_id, product_id, quantity, amount)
SELECT
  (SUBSTRING(md5(item.client_reference_id || '-item'), 1, 8) || '-' || SUBSTRING(md5(item.client_reference_id || '-item'), 9, 4) || '-' || SUBSTRING(md5(item.client_reference_id || '-item'), 13, 4) || '-' || SUBSTRING(md5(item.client_reference_id || '-item'), 17, 4) || '-' || SUBSTRING(md5(item.client_reference_id || '-item'), 21, 12))::uuid,
  po.id,
  item.product_id,
  item.quantity,
  item.amount
FROM (
  SELECT 'demo-order-cardio-boost-' || gs AS client_reference_id, '55555555-5555-5555-5555-555555555551'::uuid AS product_id, 14 + (gs % 4) AS quantity, (14 + (gs % 4)) * 1450.00::numeric AS amount
  FROM generate_series(1, 10) AS gs
  UNION ALL
  SELECT 'demo-order-gluco-older-' || gs, '55555555-5555-5555-5555-555555555552'::uuid, 8 + (gs % 3), (8 + (gs % 3)) * 680.00::numeric
  FROM generate_series(1, 10) AS gs
) AS item
JOIN pharmacy_orders po ON po.client_reference_id = item.client_reference_id
WHERE NOT EXISTS (
  SELECT 1 FROM pharmacy_order_items existing
  WHERE existing.order_id = po.id
    AND existing.product_id = item.product_id
);
