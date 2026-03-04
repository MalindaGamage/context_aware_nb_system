ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS recommended_action VARCHAR(128),
  ADD COLUMN IF NOT EXISTS recommended_message TEXT;
