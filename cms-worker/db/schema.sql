-- ─────────────────────────────────────────────────────────────────────────────
--  DATABASE SCHEMA — D1 SQLITE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  src TEXT NOT NULL,
  thumb TEXT NOT NULL,
  raw_src TEXT,
  aspect_ratio REAL NOT NULL,
  category TEXT DEFAULT '',
  location TEXT,
  date TEXT,
  desc TEXT,
  hero_slide BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  src TEXT NOT NULL,
  poster TEXT NOT NULL,
  aspect_ratio REAL NOT NULL,
  location TEXT,
  date TEXT,
  desc TEXT,
  music TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip TEXT PRIMARY KEY,
  attempts INTEGER DEFAULT 0,
  last_attempt INTEGER
);

