-- Seed core roles
INSERT INTO roles (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'MR', 'Medical Representative'),
  ('00000000-0000-0000-0000-000000000002', 'MANAGER', 'Area or Regional Manager'),
  ('00000000-0000-0000-0000-000000000003', 'ADMIN', 'System Administrator');

-- Seed demo users (IDs match Keycloak realm import)
INSERT INTO users (id, email, full_name, password_hash, is_active, created_at, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'mr1@example.com', 'MR One', NULL, TRUE, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'manager1@example.com', 'Manager One', NULL, TRUE, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'admin1@example.com', 'Admin One', NULL, TRUE, NOW(), NOW());

INSERT INTO user_roles (user_id, role_id) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000003');

INSERT INTO territories (id, name, code, boundary, created_at, updated_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Colombo Central', 'CMB-C', NULL, NOW(), NOW());

INSERT INTO territory_assignments (id, territory_id, user_id, starts_on, ends_on, created_at) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', CURRENT_DATE, NULL, NOW());

INSERT INTO doctors (id, full_name, specialty, tier, priority_score, location, territory_id, notes, created_at, updated_at) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Dr. A Perera', 'Cardiology', 'A', 90, ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Morning preferred', NOW(), NOW()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Dr. K Silva', 'Endocrinology', 'B', 75, ST_SetSRID(ST_MakePoint(79.8700, 6.9150), 4326), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Afternoon preferred', NOW(), NOW());