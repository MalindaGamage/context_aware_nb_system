ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);

UPDATE doctors
SET
  whatsapp_number = COALESCE(whatsapp_number, '+94771234567'),
  email = COALESCE(email, 'dr.a.perera@example.com')
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

UPDATE doctors
SET
  whatsapp_number = COALESCE(whatsapp_number, '+94777654321'),
  email = COALESCE(email, 'dr.k.silva@example.com')
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

UPDATE doctors
SET
  whatsapp_number = COALESCE(whatsapp_number, '+94770000000'),
  email = COALESCE(email, LOWER(REPLACE(REPLACE(full_name, 'Dr. ', ''), ' ', '.')) || '@example.com')
WHERE whatsapp_number IS NULL OR email IS NULL;
