-- Migration: Create initial schema for WLNX Health MVP
-- Run with: psql -d wlnx_health -f migrations/001_initial_schema.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tg_chat_id BIGINT UNIQUE NOT NULL,
    apple_health_uid VARCHAR(255) UNIQUE,
    dob DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Raw steps data from HealthKit
CREATE TABLE IF NOT EXISTS steps_raw (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ts TIMESTAMP NOT NULL,
    count_delta INTEGER NOT NULL,
    source VARCHAR(50) DEFAULT 'healthkit',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Daily aggregates (view for speed)
CREATE TABLE IF NOT EXISTS steps_daily (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    steps_total INTEGER DEFAULT 0,
    steps_by_hour JSONB, -- {0: 100, 1: 150, ...}
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Health notes from Notion
CREATE TABLE IF NOT EXISTS health_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    notion_page_id VARCHAR(255) UNIQUE,
    title VARCHAR(500),
    content TEXT,
    parsed_data JSONB, -- {stepGoals: [], restDays: [], rules: []}
    last_edited TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Advice log
CREATE TABLE IF NOT EXISTS advice_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    kind VARCHAR(20) CHECK (kind IN ('go_walk', 'slow_down', 'ok')),
    sent_at TIMESTAMP NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_steps_raw_user_ts ON steps_raw(user_id, ts);
CREATE INDEX IF NOT EXISTS idx_steps_daily_user_date ON steps_daily(user_id, date);
CREATE INDEX IF NOT EXISTS idx_health_notes_user ON health_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_advice_log_user_date ON advice_log(user_id, date);

-- Insert default user for MVP
INSERT INTO users (id, tg_chat_id, apple_health_uid) 
VALUES (1, 1, 'default_user') 
ON CONFLICT (id) DO NOTHING;
