-- ─────────────────────────────────────────────────────────────────────────────
--  MIGRATION 003: AUDIT TRAIL AUTH LOGS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_logs (
  id TEXT PRIMARY KEY,
  ip_address TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_created ON auth_logs(created_at);
