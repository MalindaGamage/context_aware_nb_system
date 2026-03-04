UPDATE doctors
SET target_product_focus = 'CardioPlus / Atorvastatin',
    availability_pattern = 'Morning clinic',
    availability_window = '08:30 - 11:30',
    scheduling_notes = 'Usually available before ward round'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

UPDATE doctors
SET target_product_focus = 'GlucoSure / Metformin',
    availability_pattern = 'Afternoon clinic',
    availability_window = '14:00 - 17:00',
    scheduling_notes = 'Prefers evidence from nearby pharmacies'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

INSERT INTO products (id, name, code, description, brand_name, manufacturer_type, is_active, created_at)
SELECT '55555555-5555-5555-5555-555555555553', 'Amlodipine', 'AML-5', 'Hypertension management', 'PressureLess', 'MANUFACTURED', TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = '55555555-5555-5555-5555-555555555553');

INSERT INTO products (id, name, code, description, brand_name, manufacturer_type, is_active, created_at)
SELECT '55555555-5555-5555-5555-555555555554', 'Rabeprazole', 'RAB-20', 'Acid reflux management', 'GastroEase', 'IMPORTED', TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = '55555555-5555-5555-5555-555555555554');

INSERT INTO products (id, name, code, description, brand_name, manufacturer_type, is_active, created_at)
SELECT '55555555-5555-5555-5555-555555555555', 'Cefuroxime', 'CEF-250', 'Antibiotic therapy', 'CureFast', 'IMPORTED', TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = '55555555-5555-5555-5555-555555555555');

INSERT INTO doctors (
  id, full_name, specialty, tier, priority_score, location, territory_id, notes, created_at, updated_at,
  whatsapp_number, email, target_product_focus, availability_pattern, availability_window, scheduling_notes
)
SELECT * FROM (
  VALUES
    ('cccccccc-cccc-cccc-cccc-ccccccccccd1'::uuid, 'Dr. N Fernando', 'General Medicine', 'A', 88, ST_SetSRID(ST_MakePoint(79.8580, 6.9320), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'High patient volume clinic', NOW(), NOW(), '+94770111111', 'n.fernando@example.com', 'CardioPlus / Atorvastatin', 'Morning clinic', '09:00 - 12:00', 'Responds well to pharmacy evidence'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd2'::uuid, 'Dr. P Jayasinghe', 'Internal Medicine', 'B', 81, ST_SetSRID(ST_MakePoint(79.8670, 6.9220), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Interested in diabetic outcomes', NOW(), NOW(), '+94770222222', 'p.jayasinghe@example.com', 'GlucoSure / Metformin', 'Afternoon clinic', '13:30 - 16:30', 'Ask about recent refill patterns'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd3'::uuid, 'Dr. R Wickramasinghe', 'Cardiology', 'A', 92, ST_SetSRID(ST_MakePoint(79.8730, 6.9190), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Prefers strong brand proof points', NOW(), NOW(), '+94770333333', 'r.wickramasinghe@example.com', 'CardioPlus / Atorvastatin', 'Morning clinic', '08:00 - 10:30', 'Use top-pharmacy success story'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd4'::uuid, 'Dr. S Ramanayake', 'Gastroenterology', 'B', 74, ST_SetSRID(ST_MakePoint(79.8750, 6.9130), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Values patient affordability', NOW(), NOW(), '+94770444444', 's.ramanayake@example.com', 'GastroEase / Rabeprazole', 'Evening clinic', '16:00 - 18:30', 'Bring competitor comparison'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd5'::uuid, 'Dr. T Herath', 'Family Medicine', 'C', 63, ST_SetSRID(ST_MakePoint(79.8625, 6.9170), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Open to moderate frequency visits', NOW(), NOW(), '+94770555555', 't.herath@example.com', 'PressureLess / Amlodipine', 'Afternoon clinic', '15:00 - 17:00', 'Short visits work best'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd6'::uuid, 'Dr. U Abeysekera', 'General Practice', 'B', 77, ST_SetSRID(ST_MakePoint(79.8560, 6.9240), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Looks for pharmacy uptake before switching brands', NOW(), NOW(), '+94770666666', 'u.abeysekera@example.com', 'GlucoSure / Metformin', 'Morning clinic', '10:00 - 12:00', 'Pharmacy evidence matters')
) AS seed(
  id, full_name, specialty, tier, priority_score, location, territory_id, notes, created_at, updated_at,
  whatsapp_number, email, target_product_focus, availability_pattern, availability_window, scheduling_notes
)
WHERE NOT EXISTS (SELECT 1 FROM doctors d WHERE d.id = seed.id);

INSERT INTO pharmacies (id, name, code, location, territory_id, contact_number, notes, created_at, updated_at)
SELECT * FROM (
  VALUES
    ('66666666-6666-6666-6666-666666666663'::uuid, 'HealthFirst Pharmacy', 'PH-CMB-03', ST_SetSRID(ST_MakePoint(79.8589, 6.9314), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '+94 11 200 3000', 'Known for fast-moving cardio lines', NOW(), NOW()),
    ('66666666-6666-6666-6666-666666666664'::uuid, 'CityLife Pharmacy', 'PH-CMB-04', ST_SetSRID(ST_MakePoint(79.8765, 6.9175), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '+94 11 200 4000', 'Diabetes basket recently slowed', NOW(), NOW()),
    ('66666666-6666-6666-6666-666666666665'::uuid, 'Wellness Point Pharmacy', 'PH-CMB-05', ST_SetSRID(ST_MakePoint(79.8658, 6.9263), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '+94 11 200 5000', 'Strong repeat business in chronic care', NOW(), NOW()),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'MediHub Pharmacy', 'PH-CMB-06', ST_SetSRID(ST_MakePoint(79.8707, 6.9124), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '+94 11 200 6000', 'Walk-in focused outlet', NOW(), NOW())
) AS seed(id, name, code, location, territory_id, contact_number, notes, created_at, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM pharmacies p WHERE p.id = seed.id);

INSERT INTO user_product_assignments (id, user_id, product_id, assigned_by_user_id, starts_on, ends_on, created_at)
SELECT * FROM (
  VALUES
    ('77777777-7777-7777-7777-777777777774'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '55555555-5555-5555-5555-555555555553'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - 60, NULL::date, NOW()),
    ('77777777-7777-7777-7777-777777777775'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '55555555-5555-5555-5555-555555555554'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - 60, NULL::date, NOW()),
    ('77777777-7777-7777-7777-777777777776'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - 60, NULL::date, NOW()),
    ('77777777-7777-7777-7777-777777777777'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, '55555555-5555-5555-5555-555555555552'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - 60, NULL::date, NOW()),
    ('77777777-7777-7777-7777-777777777778'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, '55555555-5555-5555-5555-555555555553'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - 60, NULL::date, NOW()),
    ('77777777-7777-7777-7777-777777777779'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, '55555555-5555-5555-5555-555555555554'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - 60, NULL::date, NOW())
) AS seed(id, user_id, product_id, assigned_by_user_id, starts_on, ends_on, created_at)
WHERE NOT EXISTS (SELECT 1 FROM user_product_assignments upa WHERE upa.id = seed.id);

INSERT INTO user_schedule_preferences (
  user_id, workday_start, workday_end, break_start, break_end, max_visits_per_day, base_location_text, planning_notes, created_at, updated_at
)
VALUES (
  '11111111-1111-1111-1111-111111111111', '08:30:00', '17:30:00', '12:30:00', '13:15:00', 8, 'Colombo Central Base',
  'Prioritize doctors linked to pharmacy sell-out changes and collect field proof before promotion follow-up.', NOW(), NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET workday_start = EXCLUDED.workday_start,
    workday_end = EXCLUDED.workday_end,
    break_start = EXCLUDED.break_start,
    break_end = EXCLUDED.break_end,
    max_visits_per_day = EXCLUDED.max_visits_per_day,
    base_location_text = EXCLUDED.base_location_text,
    planning_notes = EXCLUDED.planning_notes,
    updated_at = NOW();

INSERT INTO messages (id, product_id, title, body, created_at)
SELECT * FROM (
  VALUES
    ('99999999-9999-9999-9999-999999999991'::uuid, '55555555-5555-5555-5555-555555555551'::uuid, 'CardioPlus adherence message', 'Highlight LDL control and patient refill comfort.', NOW()),
    ('99999999-9999-9999-9999-999999999992'::uuid, '55555555-5555-5555-5555-555555555552'::uuid, 'GlucoSure availability message', 'Address refill continuity and affordability.', NOW()),
    ('99999999-9999-9999-9999-999999999993'::uuid, '55555555-5555-5555-5555-555555555554'::uuid, 'GastroEase positioning', 'Lead with tolerability and pharmacist recall.', NOW())
) AS seed(id, product_id, title, body, created_at)
WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.id = seed.id);

INSERT INTO visits (
  id, doctor_id, user_id, visit_time, outcome, notes, follow_up_required, location, created_at, client_reference_id, updated_at
)
SELECT
  (SUBSTRING(md5(v.client_reference_id), 1, 8) || '-' || SUBSTRING(md5(v.client_reference_id), 9, 4) || '-' || SUBSTRING(md5(v.client_reference_id), 13, 4) || '-' || SUBSTRING(md5(v.client_reference_id), 17, 4) || '-' || SUBSTRING(md5(v.client_reference_id), 21, 12))::uuid,
  v.doctor_id,
  '11111111-1111-1111-1111-111111111111'::uuid,
  v.visit_time,
  v.outcome,
  v.notes,
  v.follow_up_required,
  v.location,
  v.visit_time,
  v.client_reference_id,
  v.visit_time
FROM (
  VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, NOW() - INTERVAL '42 days', 'Product discussion opened', 'Doctor requested refill trend data', TRUE, ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326), 'demo-visit-dr-a-1'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, NOW() - INTERVAL '18 days', 'Follow-up completed', 'Doctor asked for strongest pharmacy proof', FALSE, ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326), 'demo-visit-dr-a-2'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, NOW() - INTERVAL '33 days', 'Promotion completed', 'Metformin uptake looked flat', TRUE, ST_SetSRID(ST_MakePoint(79.8700, 6.9150), 4326), 'demo-visit-dr-k-1'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, NOW() - INTERVAL '11 days', 'Discussion reopened', 'Doctor wanted pharmacy-level evidence', TRUE, ST_SetSRID(ST_MakePoint(79.8700, 6.9150), 4326), 'demo-visit-dr-k-2'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd1'::uuid, NOW() - INTERVAL '29 days', 'Coverage visit', 'Asked for proof from high-volume pharmacies', TRUE, ST_SetSRID(ST_MakePoint(79.8580, 6.9320), 4326), 'demo-visit-dr-n-1'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd2'::uuid, NOW() - INTERVAL '36 days', 'Coverage visit', 'Concerned about diabetic refills', TRUE, ST_SetSRID(ST_MakePoint(79.8670, 6.9220), 4326), 'demo-visit-dr-p-1'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd3'::uuid, NOW() - INTERVAL '16 days', 'High-priority promotion', 'CardioPlus brand story resonated', FALSE, ST_SetSRID(ST_MakePoint(79.8730, 6.9190), 4326), 'demo-visit-dr-r-1'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd4'::uuid, NOW() - INTERVAL '21 days', 'Promotion completed', 'Requested gastro refill trend', FALSE, ST_SetSRID(ST_MakePoint(79.8750, 6.9130), 4326), 'demo-visit-dr-s-1'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd5'::uuid, NOW() - INTERVAL '9 days', 'Quick reminder', 'Short discussion on amlodipine conversion', FALSE, ST_SetSRID(ST_MakePoint(79.8625, 6.9170), 4326), 'demo-visit-dr-t-1'),
    ('cccccccc-cccc-cccc-cccc-ccccccccccd6'::uuid, NOW() - INTERVAL '24 days', 'Promotion completed', 'Wants proof that GlucoSure is still moving', TRUE, ST_SetSRID(ST_MakePoint(79.8560, 6.9240), 4326), 'demo-visit-dr-u-1')
) AS v(doctor_id, visit_time, outcome, notes, follow_up_required, location, client_reference_id)
WHERE NOT EXISTS (
  SELECT 1 FROM visits existing
  WHERE existing.user_id = '11111111-1111-1111-1111-111111111111'
    AND existing.client_reference_id = v.client_reference_id
);

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
  SELECT CASE WHEN gs % 3 = 0 THEN '66666666-6666-6666-6666-666666666665'::uuid ELSE '66666666-6666-6666-6666-666666666661'::uuid END AS pharmacy_id,
         NOW() - (gs * INTERVAL '2 days') AS ordered_at,
         'CardioPlus reorder' AS notes,
         'demo-order-cardio-' || gs AS client_reference_id
  FROM generate_series(1, 14) AS gs
  UNION ALL
  SELECT CASE WHEN gs % 2 = 0 THEN '66666666-6666-6666-6666-666666666664'::uuid ELSE '66666666-6666-6666-6666-666666666662'::uuid END,
         NOW() - ((35 + gs * 3) * INTERVAL '1 day'),
         'GlucoSure historic order',
         'demo-order-gluco-old-' || gs
  FROM generate_series(1, 8) AS gs
  UNION ALL
  SELECT CASE WHEN gs % 2 = 0 THEN '66666666-6666-6666-6666-666666666666'::uuid ELSE '66666666-6666-6666-6666-666666666663'::uuid END,
         NOW() - (gs * INTERVAL '4 days'),
         'PressureLess reorder',
         'demo-order-pressure-' || gs
  FROM generate_series(1, 8) AS gs
  UNION ALL
  SELECT CASE WHEN gs % 2 = 0 THEN '66666666-6666-6666-6666-666666666666'::uuid ELSE '66666666-6666-6666-6666-666666666665'::uuid END,
         NOW() - (gs * INTERVAL '5 days'),
         'GastroEase reorder',
         'demo-order-gastro-' || gs
  FROM generate_series(1, 6) AS gs
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
  SELECT 'demo-order-cardio-' || gs AS client_reference_id, '55555555-5555-5555-5555-555555555551'::uuid AS product_id, 10 + (gs % 5) AS quantity, (10 + (gs % 5)) * 1450.00::numeric AS amount
  FROM generate_series(1, 14) AS gs
  UNION ALL
  SELECT 'demo-order-gluco-old-' || gs, '55555555-5555-5555-5555-555555555552'::uuid, 9 + (gs % 4), (9 + (gs % 4)) * 680.00::numeric
  FROM generate_series(1, 8) AS gs
  UNION ALL
  SELECT 'demo-order-pressure-' || gs, '55555555-5555-5555-5555-555555555553'::uuid, 6 + (gs % 3), (6 + (gs % 3)) * 520.00::numeric
  FROM generate_series(1, 8) AS gs
  UNION ALL
  SELECT 'demo-order-gastro-' || gs, '55555555-5555-5555-5555-555555555554'::uuid, 5 + (gs % 2), (5 + (gs % 2)) * 990.00::numeric
  FROM generate_series(1, 6) AS gs
) AS item
JOIN pharmacy_orders po ON po.client_reference_id = item.client_reference_id
WHERE NOT EXISTS (
  SELECT 1 FROM pharmacy_order_items existing
  WHERE existing.order_id = po.id
    AND existing.product_id = item.product_id
);

INSERT INTO pharmacy_feedback (
  id, pharmacy_id, product_id, mr_user_id, doctor_id, captured_at, prescribed, stock_available, notes, created_at
)
SELECT * FROM (
  VALUES
    ('aaaa0000-0000-0000-0000-000000000001'::uuid, '66666666-6666-6666-6666-666666666661'::uuid, '55555555-5555-5555-5555-555555555551'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, NOW() - INTERVAL '6 days', TRUE, TRUE, 'CardioPlus prescriptions are moving well here.', NOW()),
    ('aaaa0000-0000-0000-0000-000000000002'::uuid, '66666666-6666-6666-6666-666666666662'::uuid, '55555555-5555-5555-5555-555555555552'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, NOW() - INTERVAL '4 days', FALSE, TRUE, 'Patients are asking for alternatives and prescriptions are weak.', NOW()),
    ('aaaa0000-0000-0000-0000-000000000003'::uuid, '66666666-6666-6666-6666-666666666664'::uuid, '55555555-5555-5555-5555-555555555552'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'cccccccc-cccc-cccc-cccc-ccccccccccd2'::uuid, NOW() - INTERVAL '5 days', FALSE, TRUE, 'GlucoSure has almost no pull from this clinic.', NOW()),
    ('aaaa0000-0000-0000-0000-000000000004'::uuid, '66666666-6666-6666-6666-666666666663'::uuid, '55555555-5555-5555-5555-555555555551'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'cccccccc-cccc-cccc-cccc-ccccccccccd3'::uuid, NOW() - INTERVAL '3 days', TRUE, TRUE, 'CardioPlus is one of the strongest moving cardio brands.', NOW()),
    ('aaaa0000-0000-0000-0000-000000000005'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, '55555555-5555-5555-5555-555555555554'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'cccccccc-cccc-cccc-cccc-ccccccccccd4'::uuid, NOW() - INTERVAL '7 days', TRUE, TRUE, 'GastroEase is selling steadily after doctor reminders.', NOW()),
    ('aaaa0000-0000-0000-0000-000000000006'::uuid, '66666666-6666-6666-6666-666666666662'::uuid, '55555555-5555-5555-5555-555555555552'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'cccccccc-cccc-cccc-cccc-ccccccccccd6'::uuid, NOW() - INTERVAL '2 days', FALSE, TRUE, 'Doctor prescriptions have not translated into refills recently.', NOW())
) AS seed(id, pharmacy_id, product_id, mr_user_id, doctor_id, captured_at, prescribed, stock_available, notes, created_at)
WHERE NOT EXISTS (SELECT 1 FROM pharmacy_feedback pf WHERE pf.id = seed.id);

INSERT INTO recommendations (
  id, user_id, doctor_id, message_id, score, explanation, created_at, recommended_action, recommended_message
)
SELECT * FROM (
  VALUES
    ('eeee0000-0000-0000-0000-000000000001'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, '99999999-9999-9999-9999-999999999991'::uuid, 78.5, 'Strong cardio demand and high-priority territory doctor.', NOW() - INTERVAL '6 days', 'Visit High-Performing Pharmacy First', 'Start at Colombo Care Pharmacy and carry the refill trend to Dr. A Perera.'),
    ('eeee0000-0000-0000-0000-000000000002'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, '99999999-9999-9999-9999-999999999992'::uuid, 82.0, 'Metformin sell-out dropped and pharmacy says prescribing is weak.', NOW() - INTERVAL '4 days', 'Meet Doctor Again', 'Revisit Dr. K Silva with pharmacy evidence that GlucoSure is not moving.'),
    ('eeee0000-0000-0000-0000-000000000003'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'cccccccc-cccc-cccc-cccc-ccccccccccd3'::uuid, '99999999-9999-9999-9999-999999999991'::uuid, 84.0, 'Top pharmacy is moving cardio volumes strongly.', NOW() - INTERVAL '3 days', 'Visit High-Performing Pharmacy First', 'Use HealthFirst Pharmacy performance as proof before meeting Dr. R Wickramasinghe.'),
    ('eeee0000-0000-0000-0000-000000000004'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'cccccccc-cccc-cccc-cccc-ccccccccccd2'::uuid, '99999999-9999-9999-9999-999999999992'::uuid, 80.0, 'Recent sell-out decline on GlucoSure.', NOW() - INTERVAL '2 days', 'Meet Doctor Again', 'Return to Dr. P Jayasinghe because the pharmacy loop shows weak refill demand.')
) AS seed(id, user_id, doctor_id, message_id, score, explanation, created_at, recommended_action, recommended_message)
WHERE NOT EXISTS (SELECT 1 FROM recommendations r WHERE r.id = seed.id);

INSERT INTO recommendation_feedback (
  id, recommendation_id, status, reason, created_at, created_by_user_id, override_doctor_id, rescheduled_to, override_notes, client_reference_id, updated_at
)
SELECT * FROM (
  VALUES
    ('ffff0000-0000-0000-0000-000000000001'::uuid, 'eeee0000-0000-0000-0000-000000000001'::uuid, 'DONE', 'Pharmacy insight was used in the visit', NOW() - INTERVAL '5 days', '11111111-1111-1111-1111-111111111111'::uuid, NULL::uuid, NULL::timestamptz, NULL::text, 'demo-rec-feedback-1', NOW() - INTERVAL '5 days'),
    ('ffff0000-0000-0000-0000-000000000002'::uuid, 'eeee0000-0000-0000-0000-000000000002'::uuid, 'DONE', 'Doctor revisit completed after poor sell-out signal', NOW() - INTERVAL '3 days', '11111111-1111-1111-1111-111111111111'::uuid, NULL::uuid, NULL::timestamptz, NULL::text, 'demo-rec-feedback-2', NOW() - INTERVAL '3 days'),
    ('ffff0000-0000-0000-0000-000000000003'::uuid, 'eeee0000-0000-0000-0000-000000000003'::uuid, 'RESCHEDULED', 'Doctor was in theatre round', NOW() - INTERVAL '1 day', '11111111-1111-1111-1111-111111111111'::uuid, NULL::uuid, NOW() + INTERVAL '1 day', NULL::text, 'demo-rec-feedback-3', NOW() - INTERVAL '1 day')
) AS seed(id, recommendation_id, status, reason, created_at, created_by_user_id, override_doctor_id, rescheduled_to, override_notes, client_reference_id, updated_at)
WHERE NOT EXISTS (
  SELECT 1 FROM recommendation_feedback rf
  WHERE rf.created_by_user_id = seed.created_by_user_id
    AND rf.client_reference_id = seed.client_reference_id
);
