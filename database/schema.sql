-- SHARED: login
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'instructor')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COURSE & ENROLLMENT SERVICE
CREATE TABLE IF NOT EXISTS courses (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  instructor_id INTEGER NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modules (
  id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  position  INTEGER NOT NULL CHECK (position > 0),
  due_date  DATE,
  UNIQUE (course_id, position)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES users(id),
  course_id   INTEGER NOT NULL REFERENCES courses(id),
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'dropped', 'completed')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS module_completions (
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  module_id     INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (enrollment_id, module_id)
);

-- NOTES & CERTIFICATES SERVICE
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id  INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  module_id  INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  tags       TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certificates (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  file_name   TEXT NOT NULL,
  file_type   TEXT NOT NULL,
  file_size   INTEGER NOT NULL CHECK (file_size > 0),
  storage_key TEXT NOT NULL,   -- where the file sits in S3
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- STUDY TRACKING SERVICE
CREATE TABLE IF NOT EXISTS study_sessions (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id  INTEGER NOT NULL REFERENCES courses(id),
  minutes    INTEGER NOT NULL CHECK (minutes > 0),
  studied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_goals (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hours_per_week NUMERIC(4,1) NOT NULL CHECK (hours_per_week > 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id  INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('deadline_reminder', 'at_risk_alert')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  remind_at  TIMESTAMPTZ NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (type = 'at_risk_alert' AND risk_level IS NOT NULL) OR
    (type = 'deadline_reminder' AND risk_level IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS study_plans (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id       INTEGER NOT NULL REFERENCES courses(id),
  week_start      DATE NOT NULL,
  planned_minutes INTEGER NOT NULL CHECK (planned_minutes >= 0),
  UNIQUE (user_id, course_id, week_start)
);

CREATE TABLE IF NOT EXISTS activity_events (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type TEXT NOT NULL,
  student_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  module_id INTEGER,
  percent INTEGER,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES for lookups
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON study_sessions(user_id, studied_at);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, remind_at);
CREATE INDEX IF NOT EXISTS idx_activity_course ON activity_events(course_id, occurred_at DESC);
