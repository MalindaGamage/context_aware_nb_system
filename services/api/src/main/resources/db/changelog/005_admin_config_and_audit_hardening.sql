CREATE TABLE scoring_config_versions (
  id UUID PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  weights JSONB NOT NULL,
  messages JSONB NOT NULL,
  segments JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scoring_config_active
  ON scoring_config_versions (is_active, version DESC);

UPDATE scoring_config_versions
SET is_active = FALSE
WHERE is_active = TRUE;

INSERT INTO scoring_config_versions (
  id,
  version,
  name,
  weights,
  messages,
  segments,
  is_active,
  created_by_user_id,
  created_at
) VALUES (
  '99999999-9999-9999-9999-999999999901',
  1,
  'Default Baseline',
  '{
    "tierA": 25,
    "tierB": 15,
    "tierC": 8,
    "tierDefault": 4,
    "priorityScale": 35,
    "recencyScale": 15,
    "followUpBonus": 20,
    "recentVisitPenalty": -10,
    "maxRecencyDays": 45
  }'::jsonb,
  '{
    "templateTopDrivers": "{driver1}, {driver2}, {driver3}",
    "templateFallback": "Prioritized by active segment and recency"
  }'::jsonb,
  '[
    {"name":"A-HCP","tier":"A","priorityMin":80},
    {"name":"Follow-Up","followUpRequired":true}
  ]'::jsonb,
  TRUE,
  '33333333-3333-3333-3333-333333333333',
  NOW()
);
