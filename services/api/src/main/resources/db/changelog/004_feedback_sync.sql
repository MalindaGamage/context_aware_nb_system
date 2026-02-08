ALTER TABLE visits
  ADD COLUMN client_reference_id VARCHAR(80);

ALTER TABLE visits
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE visits
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE UNIQUE INDEX uk_visits_user_client_reference
  ON visits (user_id, client_reference_id)
  WHERE client_reference_id IS NOT NULL;

ALTER TABLE recommendation_feedback
  ADD COLUMN created_by_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

UPDATE recommendation_feedback rf
SET created_by_user_id = r.user_id
FROM recommendations r
WHERE r.id = rf.recommendation_id;

ALTER TABLE recommendation_feedback
  ALTER COLUMN created_by_user_id SET NOT NULL;

ALTER TABLE recommendation_feedback
  ADD COLUMN override_doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  ADD COLUMN rescheduled_to TIMESTAMPTZ,
  ADD COLUMN override_notes TEXT,
  ADD COLUMN client_reference_id VARCHAR(80),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE recommendation_feedback
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE UNIQUE INDEX uk_feedback_user_client_reference
  ON recommendation_feedback (created_by_user_id, client_reference_id)
  WHERE client_reference_id IS NOT NULL;

CREATE INDEX idx_feedback_recommendation
  ON recommendation_feedback (recommendation_id);