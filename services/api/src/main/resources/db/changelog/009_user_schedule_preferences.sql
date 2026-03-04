CREATE TABLE IF NOT EXISTS user_schedule_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  workday_start TIME NOT NULL DEFAULT '08:30:00',
  workday_end TIME NOT NULL DEFAULT '17:30:00',
  break_start TIME NULL,
  break_end TIME NULL,
  max_visits_per_day INTEGER NOT NULL DEFAULT 8,
  base_location_text VARCHAR(255),
  planning_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
