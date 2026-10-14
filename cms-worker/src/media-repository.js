export async function clearApiCache(request) {
  let purgedCount = 0;
  try {
    const cache = caches.default;
    const origin = new URL(request.url).origin;
    const limits = [50, 100, 500];
    const offsets = [0, 50, 100, 200, 300, 400];
    const urls = [`${origin}/api/photos`, `${origin}/api/videos`];
    for (const limit of limits) {
      for (const offset of offsets) {
        urls.push(`${origin}/api/photos?limit=${limit}&offset=${offset}`);
        urls.push(`${origin}/api/videos?limit=${limit}&offset=${offset}`);
      }
    }
    for (const url of urls) {
      const deleted = await cache.delete(new Request(url, { method: 'GET' }));
      if (deleted) purgedCount++;
    }
  } catch (err) {
    console.error('Failed to clear cache:', err);
  }
  return purgedCount;
}

// ── R2 Storage Operations ──

export async function getMediaObject(env, key, rangeOptions) {
  return env.MEDIA_BUCKET.get(key, rangeOptions ? { range: rangeOptions } : undefined);
}

export async function putMediaObject(env, key, data, { contentType, cacheControl = 'public, max-age=31536000, immutable' }) {
  return env.MEDIA_BUCKET.put(key, data, {
    httpMetadata: { contentType, cacheControl },
  });
}

export async function deleteMediaObjects(env, keys) {
  const filtered = Array.isArray(keys) ? [...new Set(keys.filter(Boolean))] : [keys].filter(Boolean);
  if (filtered.length === 0) return;
  try {
    await env.MEDIA_BUCKET.delete(filtered);
  } catch (err) {
    console.error('Failed to delete R2 objects:', err);
  }
}

// ── D1 SQL Operations ──

export async function fetchPhotos(env, limit, offset) {
  const [listResult, countResult] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, title, src, thumb, raw_src, lb_src, aspect_ratio, category, location, date, \`desc\`, hero_slide, created_at
       FROM photos
       ORDER BY sort_order ASC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset),
    env.DB.prepare('SELECT COUNT(*) AS total FROM photos')
  ]);

  return {
    rows: listResult.results || [],
    total: countResult.results?.[0]?.total || 0,
  };
}

export async function fetchVideos(env, limit, offset) {
  const [listResult, countResult] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, title, src, poster, aspect_ratio, location, date, \`desc\`, music, created_at
       FROM videos
       ORDER BY sort_order ASC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset),
    env.DB.prepare('SELECT COUNT(*) AS total FROM videos')
  ]);

  return {
    rows: listResult.results || [],
    total: countResult.results?.[0]?.total || 0,
  };
}

export async function findPhotoById(env, photoId) {
  return env.DB.prepare('SELECT src, thumb, raw_src, lb_src FROM photos WHERE id = ?')
    .bind(photoId)
    .first();
}

export async function findVideoById(env, videoId) {
  return env.DB.prepare('SELECT src, poster FROM videos WHERE id = ?')
    .bind(videoId)
    .first();
}

export async function deletePhotoRecord(env, photoId) {
  return env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(photoId).run();
}

export async function deleteVideoRecord(env, videoId) {
  return env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(videoId).run();
}

export async function insertPhotoRecord(env, photoData) {
  return env.DB.prepare(
    `INSERT INTO photos (title, src, thumb, raw_src, lb_src, aspect_ratio, category, location, date, \`desc\`, hero_slide)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    photoData.title,
    photoData.photoKey,
    photoData.thumbKey,
    photoData.rawKey,
    photoData.lbKey ?? null,
    photoData.aspectRatio,
    photoData.category,
    photoData.location,
    photoData.date,
    photoData.desc,
    photoData.heroSlide
  ).run();
}

export async function insertVideoRecord(env, videoData) {
  return env.DB.prepare(
    `INSERT INTO videos (title, src, poster, aspect_ratio, location, date, \`desc\`, music)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    videoData.title,
    videoData.videoKey,
    videoData.posterKey,
    videoData.aspectRatio,
    videoData.location,
    videoData.date,
    videoData.desc,
    videoData.music
  ).run();
}

export async function updatePhotoRecord(env, photoId, photoData) {
  return env.DB.prepare(
    `UPDATE photos 
     SET title = ?, category = ?, location = ?, date = ?, \`desc\` = ?, aspect_ratio = ?, hero_slide = ?
     WHERE id = ?`
  ).bind(
    photoData.title,
    photoData.category,
    photoData.location,
    photoData.date,
    photoData.desc,
    photoData.aspectRatio,
    photoData.heroSlide,
    photoId
  ).run();
}

export async function updateVideoRecord(env, videoId, videoData) {
  return env.DB.prepare(
    `UPDATE videos 
     SET title = ?, location = ?, date = ?, \`desc\` = ?, aspect_ratio = ?, music = ?
     WHERE id = ?`
  ).bind(
    videoData.title,
    videoData.location,
    videoData.date,
    videoData.desc,
    videoData.aspectRatio,
    videoData.music,
    videoId
  ).run();
}

// lbKey is always written (NULL when the edit carried no lightbox tier) so a stale lb_src
// can never keep pointing at the previous image.
export async function updatePhotoMediaKeys(env, photoId, { aspectRatio, photoKey, thumbKey, rawKey, lbKey }) {
  if (rawKey) {
    return env.DB.prepare(
      'UPDATE photos SET aspect_ratio = ?, src = ?, thumb = ?, raw_src = ?, lb_src = ? WHERE id = ?'
    ).bind(aspectRatio, photoKey, thumbKey, rawKey, lbKey ?? null, photoId).run();
  }
  return env.DB.prepare(
    'UPDATE photos SET aspect_ratio = ?, src = ?, thumb = ?, raw_src = NULL, lb_src = ? WHERE id = ?'
  ).bind(aspectRatio, photoKey, thumbKey, lbKey ?? null, photoId).run();
}

export async function getAllPhotosForSorting(env) {
  const { results } = await env.DB.prepare('SELECT id, date, created_at FROM photos').all();
  return results;
}

export async function batchUpdatePhotosSortOrder(env, photoUpdates) {
  const statements = photoUpdates.map(({ id, sortOrder }) =>
    env.DB.prepare('UPDATE photos SET sort_order = ? WHERE id = ?').bind(sortOrder, id)
  );
  if (statements.length > 0) {
    await env.DB.batch(statements);
  }
}

export async function getAllVideosForSorting(env) {
  const { results } = await env.DB.prepare('SELECT id, date, created_at FROM videos').all();
  return results;
}

export async function batchUpdateVideosSortOrder(env, videoUpdates) {
  const statements = videoUpdates.map(({ id, sortOrder }) =>
    env.DB.prepare('UPDATE videos SET sort_order = ? WHERE id = ?').bind(sortOrder, id)
  );
  if (statements.length > 0) {
    await env.DB.batch(statements);
  }
}
