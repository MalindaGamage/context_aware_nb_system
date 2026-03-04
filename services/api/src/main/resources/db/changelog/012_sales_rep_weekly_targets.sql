CREATE TABLE IF NOT EXISTS sr_weekly_targets (
  id UUID PRIMARY KEY,
  sales_rep_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
  week_start DATE NOT NULL,
  target_quantity INTEGER NOT NULL DEFAULT 0,
  target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_sr_weekly_targets_scope
  ON sr_weekly_targets (sales_rep_user_id, product_id, territory_id, week_start);

INSERT INTO sr_weekly_targets (
  id, sales_rep_user_id, product_id, territory_id, week_start, target_quantity, target_amount, assigned_by_user_id, created_at, updated_at
)
SELECT
  '88888888-8888-8888-8888-888888888881',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555551',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  DATE_TRUNC('week', CURRENT_DATE)::date,
  120,
  350000.00,
  '22222222-2222-2222-2222-222222222222',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM sr_weekly_targets
  WHERE sales_rep_user_id = '44444444-4444-4444-4444-444444444444'
    AND product_id = '55555555-5555-5555-5555-555555555551'
    AND territory_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND week_start = DATE_TRUNC('week', CURRENT_DATE)::date
);
