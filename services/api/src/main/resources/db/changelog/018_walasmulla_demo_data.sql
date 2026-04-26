INSERT INTO territories (id, name, code, boundary, created_at, updated_at)
SELECT
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid,
  'Walasmulla Area',
  'WAL-A',
  ST_MakeEnvelope(80.6200, 6.0800, 80.7800, 6.2200, 4326),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM territories WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid OR code = 'WAL-A'
);

INSERT INTO territory_assignments (id, territory_id, user_id, starts_on, ends_on, created_at)
SELECT
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb18'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  CURRENT_DATE,
  NULL,
  NOW()
WHERE EXISTS (
  SELECT 1 FROM territories WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid
)
AND EXISTS (
  SELECT 1 FROM users WHERE id = '11111111-1111-1111-1111-111111111111'::uuid
)
AND NOT EXISTS (
  SELECT 1
  FROM territory_assignments
  WHERE territory_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid
    AND user_id = '11111111-1111-1111-1111-111111111111'::uuid
    AND ends_on IS NULL
);

INSERT INTO doctors (
  id, full_name, specialty, tier, priority_score, location, territory_id, notes, created_at, updated_at,
  whatsapp_number, email, target_product_focus, availability_pattern, availability_window, scheduling_notes
)
SELECT * FROM (
  VALUES
    (
      'cccccccc-cccc-cccc-cccc-ccccccccce18'::uuid,
      'Dr. M Senanayake',
      'General Medicine',
      'A',
      86,
      ST_SetSRID(ST_MakePoint(80.6986, 6.1517), 4326),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid,
      'Walasmulla town clinic with strong chronic-care footfall',
      NOW(),
      NOW(),
      '+94771818181',
      'm.senanayake.walasmulla@example.com',
      'CardioPlus / Atorvastatin',
      'Morning clinic',
      '08:30 - 11:30',
      'Start early before the outpatient queue builds'
    ),
    (
      'cccccccc-cccc-cccc-cccc-ccccccccce19'::uuid,
      'Dr. H Wijesinghe',
      'Family Medicine',
      'B',
      78,
      ST_SetSRID(ST_MakePoint(80.7042, 6.1564), 4326),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid,
      'Regular family-practice clinic north of Walasmulla town',
      NOW(),
      NOW(),
      '+94771818182',
      'h.wijesinghe.walasmulla@example.com',
      'GlucoSure / Metformin',
      'Afternoon clinic',
      '14:00 - 17:00',
      'Discuss recent refill behavior and adherence barriers'
    ),
    (
      'cccccccc-cccc-cccc-cccc-ccccccccce20'::uuid,
      'Dr. L Karunaratne',
      'Cardiology',
      'A',
      91,
      ST_SetSRID(ST_MakePoint(80.6928, 6.1469), 4326),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid,
      'High-priority cardiac prescriber near Walasmulla junction',
      NOW(),
      NOW(),
      '+94771818183',
      'l.karunaratne.walasmulla@example.com',
      'CardioPlus / Atorvastatin',
      'Evening clinic',
      '16:00 - 18:30',
      'Use concise lipid-control evidence and pharmacy movement'
    ),
    (
      'cccccccc-cccc-cccc-cccc-ccccccccce21'::uuid,
      'Dr. N Rathnayake',
      'Endocrinology',
      'A',
      88,
      ST_SetSRID(ST_MakePoint(80.7110, 6.1498), 4326),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid,
      'Diabetes-focused clinic on the eastern approach to town',
      NOW(),
      NOW(),
      '+94771818184',
      'n.rathnayake.walasmulla@example.com',
      'GlucoSure / Metformin',
      'Morning clinic',
      '09:00 - 12:30',
      'Bring patient affordability and adherence talking points'
    ),
    (
      'cccccccc-cccc-cccc-cccc-ccccccccce22'::uuid,
      'Dr. S Abeywickrama',
      'General Practice',
      'C',
      66,
      ST_SetSRID(ST_MakePoint(80.6835, 6.1586), 4326),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid,
      'Moderate-volume practice covering nearby villages',
      NOW(),
      NOW(),
      '+94771818185',
      's.abeywickrama.walasmulla@example.com',
      'PressureLess / Amlodipine',
      'Late afternoon clinic',
      '15:30 - 18:00',
      'Keep the visit short and focus on BP-control reminders'
    ),
    (
      'cccccccc-cccc-cccc-cccc-ccccccccce23'::uuid,
      'Dr. P Amarasinghe',
      'Gastroenterology',
      'B',
      73,
      ST_SetSRID(ST_MakePoint(80.7018, 6.1396), 4326),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid,
      'Gastro clinic south of the town center',
      NOW(),
      NOW(),
      '+94771818186',
      'p.amarasinghe.walasmulla@example.com',
      'GastroEase / Rabeprazole',
      'Evening clinic',
      '17:00 - 19:00',
      'Lead with tolerability and affordability comparison'
    )
) AS seed(
  id, full_name, specialty, tier, priority_score, location, territory_id, notes, created_at, updated_at,
  whatsapp_number, email, target_product_focus, availability_pattern, availability_window, scheduling_notes
)
WHERE EXISTS (
  SELECT 1 FROM territories WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa18'::uuid
)
AND NOT EXISTS (
  SELECT 1 FROM doctors d WHERE d.id = seed.id
);
