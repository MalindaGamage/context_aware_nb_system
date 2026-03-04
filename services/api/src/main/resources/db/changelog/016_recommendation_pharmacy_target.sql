ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS recommended_pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recommended_pharmacy_name VARCHAR(255);
