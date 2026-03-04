ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS target_product_focus VARCHAR(255),
  ADD COLUMN IF NOT EXISTS availability_pattern VARCHAR(255),
  ADD COLUMN IF NOT EXISTS availability_window VARCHAR(128),
  ADD COLUMN IF NOT EXISTS scheduling_notes TEXT;
