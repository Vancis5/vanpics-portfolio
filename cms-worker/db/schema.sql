-- ─────────────────────────────────────────────────────────────────────────────
--  DATABASE SCHEMA — D1 SQLITE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  src TEXT NOT NULL,
  thumb TEXT NOT NULL,
  raw_src TEXT,
  lb_src TEXT,
  aspect_ratio REAL NOT NULL,
  category TEXT DEFAULT '',
  location TEXT,
  date TEXT,
  `desc` TEXT,
  hero_slide BOOLEAN DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
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
  `desc` TEXT,
  music TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip TEXT PRIMARY KEY,
  attempts INTEGER DEFAULT 0,
  last_attempt INTEGER
);

CREATE TABLE IF NOT EXISTS auth_logs (
  id TEXT PRIMARY KEY,
  ip_address TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_photos_sort_order ON photos(sort_order ASC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_photos_category ON photos(category);
CREATE INDEX IF NOT EXISTS idx_videos_sort_order ON videos(sort_order ASC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created ON auth_logs(created_at);

