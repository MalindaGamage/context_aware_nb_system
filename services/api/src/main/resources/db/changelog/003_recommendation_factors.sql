CREATE TABLE recommendation_factors (
  id UUID PRIMARY KEY,
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  factor_key VARCHAR(100) NOT NULL,
  factor_value TEXT NOT NULL,
  contribution NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recommendation_factors_recommendation_id
  ON recommendation_factors (recommendation_id);