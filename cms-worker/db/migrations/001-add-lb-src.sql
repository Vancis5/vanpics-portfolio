-- P5: nullable 1600px lightbox tier. Existing rows stay NULL; clients fall back to `src`.
-- Run ONCE per database, BEFORE deploying the worker that selects lb_src:
--   npx wrangler d1 execute vanpics-db --remote --file=cms-worker/db/migrations/001-add-lb-src.sql
-- (local dev DB: use --local instead of --remote)
ALTER TABLE photos ADD COLUMN lb_src TEXT;
