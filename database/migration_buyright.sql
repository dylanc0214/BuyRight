-- database/migration_buyright.sql

-- 1. Expand users table for auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
-- Change role from enum to varchar so we can add 'admin'
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20) USING role::text;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
UPDATE users SET role = 'user' WHERE role IN ('buyer', 'seller');

-- 2. submission_status enum
DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM (
    'submitted', 'inspection_scheduled', 'under_review',
    'offer_sent', 'accepted', 'rejected', 'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. car_submissions
CREATE TABLE IF NOT EXISTS car_submissions (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  brand            VARCHAR(100) NOT NULL,
  model            VARCHAR(100) NOT NULL,
  variant          VARCHAR(100),
  year             INTEGER NOT NULL,
  mileage_km       INTEGER NOT NULL,
  condition        VARCHAR(20) NOT NULL,
  color            VARCHAR(50),
  description      TEXT,
  photos           JSONB DEFAULT '[]',
  status           submission_status NOT NULL DEFAULT 'submitted',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. inspections
CREATE TABLE IF NOT EXISTS inspections (
  id             SERIAL PRIMARY KEY,
  submission_id  INTEGER REFERENCES car_submissions(id) ON DELETE CASCADE,
  scheduled_at   TIMESTAMP NOT NULL,
  location       VARCHAR(255) NOT NULL,
  notes          TEXT,
  completed      BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. offers
CREATE TABLE IF NOT EXISTS offers (
  id             SERIAL PRIMARY KEY,
  submission_id  INTEGER REFERENCES car_submissions(id) ON DELETE CASCADE,
  offer_price    NUMERIC(12,2) NOT NULL CHECK (offer_price > 0),
  notes          TEXT,
  expires_at     TIMESTAMP,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  responded_at   TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. enquiries (buyer contact-to-buy)
CREATE TABLE IF NOT EXISTS enquiries (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  car_id       INTEGER REFERENCES cars(id) ON DELETE CASCADE,
  name         VARCHAR(255),
  phone        VARCHAR(30),
  message      TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'new',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_car_submissions_updated_at ON car_submissions;
CREATE TRIGGER update_car_submissions_updated_at
  BEFORE UPDATE ON car_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes on FK columns (PostgreSQL does not auto-index FKs)
CREATE INDEX IF NOT EXISTS idx_car_submissions_user_id ON car_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_inspections_submission_id ON inspections(submission_id);
CREATE INDEX IF NOT EXISTS idx_offers_submission_id ON offers(submission_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_user_id ON enquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_car_id ON enquiries(car_id);
