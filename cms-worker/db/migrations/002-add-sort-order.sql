ALTER TABLE photos ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN sort_order INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_photos_sort_order ON photos(sort_order ASC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_videos_sort_order ON videos(sort_order ASC, created_at DESC, id DESC);
