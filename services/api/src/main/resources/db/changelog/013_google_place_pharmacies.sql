ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uk_pharmacies_google_place_id
  ON pharmacies (google_place_id)
  WHERE google_place_id IS NOT NULL;
