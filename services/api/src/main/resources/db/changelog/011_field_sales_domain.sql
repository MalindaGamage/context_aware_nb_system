INSERT INTO roles (id, name, description)
SELECT '00000000-0000-0000-0000-000000000004', 'SALES_REP', 'Pharmacy Sales Representative'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'SALES_REP');

INSERT INTO users (id, email, full_name, password_hash, is_active, created_at, updated_at)
SELECT '44444444-4444-4444-4444-444444444444', 'sales1@example.com', 'Sales Rep One', NULL, TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = '44444444-4444-4444-4444-444444444444');

INSERT INTO user_roles (user_id, role_id)
SELECT '44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000004'
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = '44444444-4444-4444-4444-444444444444'
    AND role_id = '00000000-0000-0000-0000-000000000004'
);

INSERT INTO territory_assignments (id, territory_id, user_id, starts_on, ends_on, created_at)
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', CURRENT_DATE, NULL, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM territory_assignments
  WHERE user_id = '44444444-4444-4444-4444-444444444444'
    AND territory_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND ends_on IS NULL
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS manufacturer_type VARCHAR(64),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS pharmacies (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) UNIQUE NOT NULL,
  location GEOMETRY(POINT,4326),
  territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
  contact_number VARCHAR(32),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_product_assignments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  starts_on DATE NOT NULL,
  ends_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacy_orders (
  id UUID PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  sales_rep_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
  ordered_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  client_reference_id VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacy_order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS pharmacy_feedback (
  id UUID PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  mr_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  prescribed BOOLEAN,
  stock_available BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pharmacies_location ON pharmacies USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_pharmacies_territory ON pharmacies (territory_id);
CREATE INDEX IF NOT EXISTS idx_user_product_assignments_user ON user_product_assignments (user_id, starts_on DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_rep_time ON pharmacy_orders (sales_rep_user_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pharmacy_time ON pharmacy_orders (pharmacy_id, ordered_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uk_pharmacy_orders_user_client_reference
  ON pharmacy_orders (sales_rep_user_id, client_reference_id)
  WHERE client_reference_id IS NOT NULL;

INSERT INTO products (id, name, code, description, brand_name, manufacturer_type, is_active, created_at)
SELECT '55555555-5555-5555-5555-555555555551', 'Atorvastatin', 'ATOR-10', 'Cholesterol management', 'CardioPlus', 'IMPORTED', TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = '55555555-5555-5555-5555-555555555551');

INSERT INTO products (id, name, code, description, brand_name, manufacturer_type, is_active, created_at)
SELECT '55555555-5555-5555-5555-555555555552', 'Metformin', 'MET-500', 'Diabetes management', 'GlucoSure', 'MANUFACTURED', TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = '55555555-5555-5555-5555-555555555552');

INSERT INTO pharmacies (id, name, code, location, territory_id, contact_number, notes, created_at, updated_at)
SELECT '66666666-6666-6666-6666-666666666661', 'Colombo Care Pharmacy', 'PH-CMB-01', ST_SetSRID(ST_MakePoint(79.8640, 6.9290), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '+94 11 200 1000', 'High-volume city pharmacy', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM pharmacies WHERE id = '66666666-6666-6666-6666-666666666661');

INSERT INTO pharmacies (id, name, code, location, territory_id, contact_number, notes, created_at, updated_at)
SELECT '66666666-6666-6666-6666-666666666662', 'Lanka Med Pharmacy', 'PH-CMB-02', ST_SetSRID(ST_MakePoint(79.8710, 6.9180), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '+94 11 200 2000', 'Doctor-linked dispensing outlet', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM pharmacies WHERE id = '66666666-6666-6666-6666-666666666662');

INSERT INTO user_product_assignments (id, user_id, product_id, assigned_by_user_id, starts_on, ends_on, created_at)
SELECT '77777777-7777-7777-7777-777777777771', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555551', '22222222-2222-2222-2222-222222222222', CURRENT_DATE, NULL, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM user_product_assignments
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND product_id = '55555555-5555-5555-5555-555555555551'
    AND ends_on IS NULL
);

INSERT INTO user_product_assignments (id, user_id, product_id, assigned_by_user_id, starts_on, ends_on, created_at)
SELECT '77777777-7777-7777-7777-777777777772', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555552', '22222222-2222-2222-2222-222222222222', CURRENT_DATE, NULL, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM user_product_assignments
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND product_id = '55555555-5555-5555-5555-555555555552'
    AND ends_on IS NULL
);

INSERT INTO user_product_assignments (id, user_id, product_id, assigned_by_user_id, starts_on, ends_on, created_at)
SELECT '77777777-7777-7777-7777-777777777773', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555551', '22222222-2222-2222-2222-222222222222', CURRENT_DATE, NULL, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM user_product_assignments
  WHERE user_id = '44444444-4444-4444-4444-444444444444'
    AND product_id = '55555555-5555-5555-5555-555555555551'
    AND ends_on IS NULL
);
