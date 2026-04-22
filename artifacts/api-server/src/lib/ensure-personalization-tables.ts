import { pool } from "@workspace/db";

export async function ensurePersonalizationTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
      budget_min REAL,
      budget_max REAL,
      household_size INTEGER,
      primary_use TEXT,
      preferred_body_types TEXT[] NOT NULL DEFAULT '{}',
      preferred_fuel_types TEXT[] NOT NULL DEFAULT '{}',
      preferred_transmissions TEXT[] NOT NULL DEFAULT '{}',
      preferred_brands TEXT[] NOT NULL DEFAULT '{}',
      profile_stage TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      car_id INTEGER,
      query_text TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      car_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_favorites_user_car_idx
    ON user_favorites(user_id, car_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_events_user_created_idx
    ON user_events(user_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_events_user_type_idx
    ON user_events(user_id, event_type);
  `);
}
