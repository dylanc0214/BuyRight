-- KeretaAI - Database Schema
-- PostgreSQL 15 compatible

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE transmission_enum AS ENUM ('Automatic', 'Manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fuel_enum AS ENUM ('Petrol', 'Diesel', 'Hybrid', 'EV');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE body_type_enum AS ENUM ('Hatchback', 'Sedan', 'SUV', 'MPV', 'Pickup', 'Coupe', 'Wagon');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE seller_type_enum AS ENUM ('Dealer', 'Private');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE car_status_enum AS ENUM ('available', 'reserved', 'sold');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('buyer', 'seller');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE conversation_state_enum AS ENUM ('gathering_info', 'results_shown', 'refining', 'details_viewing', 'selling', 'comparing', 'complete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  phone       VARCHAR(30),
  role        user_role_enum NOT NULL DEFAULT 'buyer',
  city        VARCHAR(100),
  state       VARCHAR(100),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sellers (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name             VARCHAR(255) NOT NULL,
  phone            VARCHAR(30),
  seller_type      seller_type_enum NOT NULL DEFAULT 'Private',
  dealership_name  VARCHAR(255),
  city             VARCHAR(100) NOT NULL,
  state            VARCHAR(100) NOT NULL,
  rating           NUMERIC(2,1) DEFAULT 4.0 CHECK (rating BETWEEN 0 AND 5),
  verified         BOOLEAN DEFAULT FALSE,
  photo_url        TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cars (
  id                SERIAL PRIMARY KEY,
  title             VARCHAR(255) NOT NULL,
  brand             VARCHAR(100) NOT NULL,
  model             VARCHAR(100) NOT NULL,
  variant           VARCHAR(100),
  year              INTEGER NOT NULL CHECK (year BETWEEN 1990 AND 2027),
  price             NUMERIC(12,2) NOT NULL,
  market_value_min  NUMERIC(12,2) NOT NULL,
  market_value_max  NUMERIC(12,2) NOT NULL,
  mileage_km        INTEGER NOT NULL,
  transmission      transmission_enum NOT NULL DEFAULT 'Automatic',
  fuel_type         fuel_enum NOT NULL DEFAULT 'Petrol',
  body_type         body_type_enum NOT NULL,
  color             VARCHAR(50),
  engine_cc         INTEGER,
  seats             INTEGER DEFAULT 5,
  dealscore         INTEGER NOT NULL CHECK (dealscore BETWEEN 0 AND 100),
  ai_summary        TEXT,
  city              VARCHAR(100) NOT NULL,
  state             VARCHAR(100) NOT NULL,
  image_url         TEXT,
  seller_id         INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
  status            car_status_enum NOT NULL DEFAULT 'available',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id               SERIAL PRIMARY KEY,
  conversation_id  UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  session_context  JSONB NOT NULL DEFAULT '{}',
  state            conversation_state_enum NOT NULL DEFAULT 'gathering_info',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cars_brand        ON cars(brand);
CREATE INDEX IF NOT EXISTS idx_cars_price        ON cars(price);
CREATE INDEX IF NOT EXISTS idx_cars_year         ON cars(year);
CREATE INDEX IF NOT EXISTS idx_cars_state        ON cars(state);
CREATE INDEX IF NOT EXISTS idx_cars_city         ON cars(city);
CREATE INDEX IF NOT EXISTS idx_cars_body_type    ON cars(body_type);
CREATE INDEX IF NOT EXISTS idx_cars_status       ON cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_seller       ON cars(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_id  ON conversations(conversation_id);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cars_updated_at ON cars;
CREATE TRIGGER update_cars_updated_at
  BEFORE UPDATE ON cars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sellers_updated_at ON sellers;
CREATE TRIGGER update_sellers_updated_at
  BEFORE UPDATE ON sellers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
