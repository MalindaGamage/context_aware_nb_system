CREATE TABLE IF NOT EXISTS pharmacy_visits (
  id UUID PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ NOT NULL,
  outcome VARCHAR(120) NOT NULL,
  notes TEXT,
  location GEOMETRY(POINT,4326),
  client_reference_id VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_visits_user_time ON pharmacy_visits (user_id, visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_visits_pharmacy_time ON pharmacy_visits (pharmacy_id, visited_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uk_pharmacy_visits_user_client_reference
  ON pharmacy_visits (user_id, client_reference_id)
  WHERE client_reference_id IS NOT NULL;
