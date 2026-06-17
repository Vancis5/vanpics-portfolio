import { corsHeaders, errorResponse, jsonResponse } from './http.js';
import {
  extensionForContentType,
  inferContentType,
  makeMediaKey,
  mediaKey,
  publicPhoto,
  publicVideo,
} from './media.js';
import {
  isFileLike,
  parsePagination,
  validatePhotoFields,
  validateVideoFields,
  cleanText,
  parseAspectRatio,
  ALLOWED_CATEGORIES,
} from './validation.js';

// 10 MB for images, 100 MB for videos
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

// Reject keys that could traverse R2 bucket structure
function isValidMediaKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.includes('\\')) return false;
  if (key.includes('..') || key.includes('./') || key.includes('/.')) return false;
  if (key.includes('//')) return false;
  if (key.startsWith('/') || key.endsWith('/') || key.startsWith('.') || key.endsWith('.')) return false;
  return /^[a-zA-Z0-9\-_./]+$/.test(key);
}

export async function serveMedia(request, env, params, ctx) {
  const fileKey = decodeURIComponent(params.key);

  if (!isValidMediaKey(fileKey)) {
    return new Response('Invalid media key', {
      status: 400,
      headers: corsHeaders(request, env),
    });
  }

  const rangeHeader = request.headers.get('Range');

  // 1. Try Cloudflare CDN edge cache first (only for non-range requests)
  let cacheKey;
  let cache;
  if (!rangeHeader) {
    const cacheUrl = new URL(request.url);
    cacheKey = new Request(cacheUrl.toString(), request);
    cache = caches.default;

    let cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
  }

  // 2. Parse Range header into R2-compatible range options
  let rangeOptions;
  let isRangeRequest = false;
  if (rangeHeader) {
    const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
    if (match) {
      isRangeRequest = true;
      const startStr = match[1];
      const endStr = match[2];
      if (startStr === '' && endStr !== '') {
        // suffix range: bytes=-500
        rangeOptions = { suffix: parseInt(endStr, 10) };
      } else {
        const offset = startStr ? parseInt(startStr, 10) : 0;
        if (endStr) {
          rangeOptions = { offset, length: parseInt(endStr, 10) - offset + 1 };
        } else {
          // open-ended range: bytes=500- (R2 returns offset to end)
          rangeOptions = { offset };
        }
      }
    }
  }

  // 3. Single GET from R2 — object.size gives total size, no HEAD needed
  const object = await env.MEDIA_BUCKET.get(fileKey, rangeOptions ? { range: rangeOptions } : undefined);

  if (!object) {
    return new Response('Media asset not found', {
      status: 404,
      headers: corsHeaders(request, env),
    });
  }

  const totalSize = object.size;
  const headers = new Headers(corsHeaders(request, env));
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Access-Control-Allow-Origin', '*');

  if (!headers.has('Content-Type') || headers.get('Content-Type') === 'application/octet-stream') {
    headers.set('Content-Type', inferContentType(fileKey));
  }

  let status = 200;
  if (isRangeRequest && object.range) {
    status = 206;
    const offset = object.range.offset ?? 0;
    const length = object.range.length ?? totalSize;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${totalSize}`);
    headers.set('Content-Length', length.toString());
  } else {
    headers.set('Content-Length', totalSize.toString());
  }

  const response = new Response(object.body, { status, headers });

  // 4. Cache full responses at the edge in background (non-blocking)
  if (!rangeHeader && request.method === 'GET' && totalSize > 0 && cache) {
    const putPromise = cache.put(cacheKey, response.clone());
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(putPromise);
    }
    // No ctx? Fire-and-forget — never block the response on a cache write
  }

  return response;
}

export async function listPhotos(request, env, params, ctx) {
  // Edge cache: serve cached JSON if available
  const cache = caches.default;
  const cacheUrl = new URL(request.url).toString();
  const cacheReq = new Request(cacheUrl, { method: 'GET' });
  const cached = await cache.match(cacheReq);
  if (cached) return cached;

  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url.searchParams);
  const { results } = await env.DB.prepare(
    `SELECT id, title, src, thumb, aspect_ratio, category, location, date, desc, hero_slide, created_at
     FROM photos
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  const totalRow = await env.DB.prepare('SELECT COUNT(*) AS total FROM photos').first();
  const items = results.map((row) => publicPhoto(request, row));

  const body = JSON.stringify({
    items,
    pagination: {
      limit,
      offset,
      total: totalRow?.total || 0,
      nextOffset: items.length === limit ? offset + limit : null,
    },
  });

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=300, max-age=60',
    },
  });

  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(cacheReq, response.clone()));
  }

  return response;
}

export async function listVideos(request, env, params, ctx) {
  // Edge cache: serve cached JSON if available
  const cache = caches.default;
  const cacheUrl = new URL(request.url).toString();
  const cacheReq = new Request(cacheUrl, { method: 'GET' });
  const cached = await cache.match(cacheReq);
  if (cached) return cached;

  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url.searchParams);
  const { results } = await env.DB.prepare(
    `SELECT id, title, src, poster, aspect_ratio, location, date, desc, music, created_at
     FROM videos
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  const totalRow = await env.DB.prepare('SELECT COUNT(*) AS total FROM videos').first();
  const items = results.map((row) => publicVideo(request, row));

  const body = JSON.stringify({
    items,
    pagination: {
      limit,
      offset,
      total: totalRow?.total || 0,
      nextOffset: items.length === limit ? offset + limit : null,
    },
  });

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=300, max-age=60',
    },
  });

  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(cacheReq, response.clone()));
  }

  return response;
}

export async function deletePhoto(request, env, params) {
  const photoId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(photoId) || photoId < 1) {
    return errorResponse(request, env, 'invalid photo id', 400);
  }

  const photo = await env.DB.prepare('SELECT src, thumb FROM photos WHERE id = ?')
    .bind(photoId)
    .first();

  if (!photo) {
    return errorResponse(request, env, 'photo not found', 404);
  }

  const keysToDelete = [...new Set([
    mediaKey(photo.src),
    mediaKey(photo.thumb)
  ].filter(Boolean))];
  if (keysToDelete.length > 0) {
    await env.MEDIA_BUCKET.delete(keysToDelete);
  }

  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(photoId).run();
  return jsonResponse(request, env, { success: true });
}

export async function deleteVideo(request, env, params) {
  const videoId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(videoId) || videoId < 1) {
    return errorResponse(request, env, 'invalid video id', 400);
  }

  const video = await env.DB.prepare('SELECT src, poster FROM videos WHERE id = ?')
    .bind(videoId)
    .first();

  if (!video) {
    return errorResponse(request, env, 'video not found', 404);
  }

  const keysToDelete = [mediaKey(video.src), mediaKey(video.poster)].filter(Boolean);
  if (keysToDelete.length > 0) {
    await env.MEDIA_BUCKET.delete(keysToDelete);
  }

  await env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(videoId).run();
  return jsonResponse(request, env, { success: true });
}

export async function uploadPhoto(request, env) {
  const formData = await request.formData();
  const photoFile = formData.get('photo');
  const thumbFile = formData.get('thumb');
  const { data, errors } = validatePhotoFields(formData);

  if (!isFileLike(photoFile, 'image/') || !isFileLike(thumbFile, 'image/')) {
    errors.push('missing processed image assets');
  }

  // Enforce file size limits
  if (photoFile?.size > MAX_IMAGE_SIZE) errors.push(`photo exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
  if (thumbFile?.size > MAX_IMAGE_SIZE) errors.push(`thumbnail exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);

  if (errors.length > 0) {
    return jsonResponse(request, env, { error: 'validation failed', details: errors }, { status: 400 });
  }

  const photoKey = makeMediaKey('photos', 'webp');
  const thumbKey = makeMediaKey('thumbs', 'webp');

  const puts = [
    env.MEDIA_BUCKET.put(photoKey, await photoFile.arrayBuffer(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    }),
    env.MEDIA_BUCKET.put(thumbKey, await thumbFile.arrayBuffer(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    }),
  ];

  await Promise.all(puts);

  const result = await env.DB.prepare(
    `INSERT INTO photos (title, src, thumb, aspect_ratio, category, location, date, desc, hero_slide)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      data.title,
      photoKey,
      thumbKey,
      data.aspectRatio,
      data.category,
      data.location,
      data.date,
      data.desc,
      data.heroSlide
    )
    .run();

  return jsonResponse(request, env, {
    success: true,
    photo: publicPhoto(request, {
      id: result.meta.last_row_id,
      title: data.title,
      src: photoKey,
      thumb: thumbKey,
      aspect_ratio: data.aspectRatio,
      category: data.category,
      location: data.location,
      date: data.date,
      desc: data.desc,
      hero_slide: data.heroSlide,
    }),
  });
}

export async function uploadVideo(request, env) {
  const formData = await request.formData();
  const videoFile = formData.get('video');
  const posterFile = formData.get('poster');
  const { data, errors } = validateVideoFields(formData);

  if (!isFileLike(videoFile, 'video/')) {
    errors.push('missing video asset');
  }

  if (!isFileLike(posterFile, 'image/')) {
    errors.push('missing poster image asset');
  }

  // Enforce file size limits
  if (videoFile?.size > MAX_VIDEO_SIZE) errors.push(`video exceeds ${MAX_VIDEO_SIZE / 1024 / 1024}MB limit`);
  if (posterFile?.size > MAX_IMAGE_SIZE) errors.push(`poster exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);

  if (errors.length > 0) {
    return jsonResponse(request, env, { error: 'validation failed', details: errors }, { status: 400 });
  }

  const videoExt = extensionForContentType(videoFile.type, 'mp4');
  const videoKey = makeMediaKey('videos', videoExt);
  const posterKey = makeMediaKey('posters', 'webp');

  await Promise.all([
    env.MEDIA_BUCKET.put(videoKey, await videoFile.arrayBuffer(), {
      httpMetadata: { contentType: videoFile.type || 'video/mp4', cacheControl: 'public, max-age=31536000, immutable' },
    }),
    env.MEDIA_BUCKET.put(posterKey, await posterFile.arrayBuffer(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    }),
  ]);

  const result = await env.DB.prepare(
    `INSERT INTO videos (title, src, poster, aspect_ratio, location, date, desc, music)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      data.title,
      videoKey,
      posterKey,
      data.aspectRatio,
      data.location,
      data.date,
      data.desc,
      data.music
    )
    .run();

  return jsonResponse(request, env, {
    success: true,
    video: publicVideo(request, {
      id: result.meta.last_row_id,
      title: data.title,
      src: videoKey,
      poster: posterKey,
      aspect_ratio: data.aspectRatio,
      location: data.location,
      date: data.date,
      desc: data.desc,
      music: data.music,
    }),
  });
}

export async function updatePhoto(request, env, params) {
  const photoId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(photoId) || photoId < 1) {
    return errorResponse(request, env, 'invalid photo id', 400);
  }

  const json = await request.json();
  const errors = [];
  
  const title = cleanText(json.title || 'Untitled', 'title', errors, { required: true });
  const category = cleanText(json.category, 'category', errors);
  const location = cleanText(json.location, 'location', errors);
  const date = cleanText(json.date, 'date', errors);
  const desc = cleanText(json.desc, 'desc', errors);
  const aspectRatio = parseAspectRatio(json.aspectRatio, errors);
  const heroSlide = json.heroSlide === true || json.heroSlide === 1 || json.heroSlide === 'true' ? 1 : 0;

  if (!ALLOWED_CATEGORIES.has(category)) {
    errors.push('category is not supported');
  }

  if (errors.length > 0) {
    return jsonResponse(request, env, { error: 'validation failed', details: errors }, { status: 400 });
  }

  const result = await env.DB.prepare(
    `UPDATE photos 
     SET title = ?, category = ?, location = ?, date = ?, desc = ?, aspect_ratio = ?, hero_slide = ?
     WHERE id = ?`
  )
  .bind(title, category, location, date, desc, aspectRatio, heroSlide, photoId)
  .run();

  if (result.meta.changes === 0) {
    return errorResponse(request, env, 'photo not found', 404);
  }

  return jsonResponse(request, env, { success: true });
}

export async function updateVideo(request, env, params) {
  const videoId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(videoId) || videoId < 1) {
    return errorResponse(request, env, 'invalid video id', 400);
  }

  const json = await request.json();
  const errors = [];

  const title = cleanText(json.title || 'Untitled', 'title', errors, { required: true });
  const location = cleanText(json.location, 'location', errors);
  const date = cleanText(json.date, 'date', errors);
  const desc = cleanText(json.desc, 'desc', errors);
  const aspectRatio = parseAspectRatio(json.aspectRatio, errors);
  const music = cleanText(json.music, 'music', errors, { max: 200 });

  if (errors.length > 0) {
    return jsonResponse(request, env, { error: 'validation failed', details: errors }, { status: 400 });
  }

  const result = await env.DB.prepare(
    `UPDATE videos 
     SET title = ?, location = ?, date = ?, desc = ?, aspect_ratio = ?, music = ?
     WHERE id = ?`
  )
  .bind(title, location, date, desc, aspectRatio, music, videoId)
  .run();

  if (result.meta.changes === 0) {
    return errorResponse(request, env, 'video not found', 404);
  }

  return jsonResponse(request, env, { success: true });
}

export async function purgeCache(request, env) {
  const cache = caches.default;
  const origin = new URL(request.url).origin;
  
  const urls = [
    `${origin}/api/photos`,
    `${origin}/api/photos?limit=100`,
    `${origin}/api/videos`,
    `${origin}/api/videos?limit=100`
  ];
  
  let purgedCount = 0;
  for (const url of urls) {
    const deleted = await cache.delete(new Request(url));
    if (deleted) purgedCount++;
  }
  
  return jsonResponse(request, env, { success: true, purgedCount });
}

export async function sortDatabase(request, env) {
  // 1. Sort Photos
  const { results: photos } = await env.DB.prepare(
    'SELECT id, date, created_at FROM photos'
  ).all();

  function parsePhotoDate(dateStr) {
    if (!dateStr) return null;
    const cleanStr = dateStr.trim().toLowerCase();
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) return d;
    if (/^\d{4}$/.test(cleanStr)) {
      return new Date(`${cleanStr}-01-01`);
    }
    return null;
  }

  // Sort photos newest first
  photos.sort((a, b) => {
    const dateA = parsePhotoDate(a.date);
    const dateB = parsePhotoDate(b.date);

    if (dateA && dateB) {
      return dateB - dateA;
    }
    if (dateA) return -1;
    if (dateB) return 1;

    // Fallback to original created_at
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  });

  // Batch update photos
  const baseTime = Date.now();
  const photoStatements = photos.map((photo, index) => {
    const itemTime = new Date(baseTime - index * 10000);
    const isoString = itemTime.toISOString().replace('T', ' ').substring(0, 19);
    
    return env.DB.prepare(
      'UPDATE photos SET created_at = ? WHERE id = ?'
    ).bind(isoString, photo.id);
  });

  if (photoStatements.length > 0) {
    await env.DB.batch(photoStatements);
  }

  // 2. Sort Videos
  const { results: videos } = await env.DB.prepare(
    'SELECT id, date, created_at FROM videos'
  ).all();

  videos.sort((a, b) => {
    const dateA = parsePhotoDate(a.date);
    const dateB = parsePhotoDate(b.date);

    if (dateA && dateB) {
      return dateB - dateA;
    }
    if (dateA) return -1;
    if (dateB) return 1;

    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  });

  const videoStatements = videos.map((video, index) => {
    const itemTime = new Date(baseTime - index * 10000);
    const isoString = itemTime.toISOString().replace('T', ' ').substring(0, 19);
    
    return env.DB.prepare(
      'UPDATE videos SET created_at = ? WHERE id = ?'
    ).bind(isoString, video.id);
  });

  if (videoStatements.length > 0) {
    await env.DB.batch(videoStatements);
  }

  // Purge the cache immediately after sorting so order propagates instantly!
  const cache = caches.default;
  const origin = new URL(request.url).origin;
  const urls = [
    `${origin}/api/photos`,
    `${origin}/api/photos?limit=100`,
    `${origin}/api/videos`,
    `${origin}/api/videos?limit=100`
  ];
  for (const url of urls) {
    await cache.delete(new Request(url));
  }

  return jsonResponse(request, env, { 
    success: true, 
    sortedPhotos: photos.length, 
    sortedVideos: videos.length 
  });
}

export async function replacePhotoFile(request, env, params) {
  const photoId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(photoId) || photoId < 1) {
    return errorResponse(request, env, 'invalid photo id', 400);
  }

  const formData = await request.formData();
  const photoFile = formData.get('photo');
  const thumbFile = formData.get('thumb');
  const aspectRatio = parseFloat(formData.get('aspectRatio'));

  const errors = [];
  if (!photoFile || !thumbFile) {
    errors.push('missing processed image assets');
  }
  if (isNaN(aspectRatio)) {
    errors.push('invalid aspect ratio');
  }

  if (errors.length > 0) {
    return jsonResponse(request, env, { error: 'validation failed', details: errors }, { status: 400 });
  }

  // 1. Get the existing keys from D1
  const photo = await env.DB.prepare(
    'SELECT src, thumb FROM photos WHERE id = ?'
  ).bind(photoId).first();

  if (!photo) {
    return errorResponse(request, env, 'photo record not found', 404);
  }

  // 2. Put / overwrite the files in R2 using the existing keys
  const puts = [
    env.MEDIA_BUCKET.put(photo.src, await photoFile.arrayBuffer(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    }),
    env.MEDIA_BUCKET.put(photo.thumb, await thumbFile.arrayBuffer(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    }),
  ];

  await Promise.all(puts);

  // 3. Update the aspect_ratio in D1
  await env.DB.prepare(
    'UPDATE photos SET aspect_ratio = ? WHERE id = ?'
  ).bind(aspectRatio, photoId).run();

  // 4. Purge the CDN cache for all API feeds instantly!
  const cache = caches.default;
  const origin = new URL(request.url).origin;
  const urls = [
    `${origin}/api/photos`,
    `${origin}/api/photos?limit=100`,
    `${origin}/api/videos`,
    `${origin}/api/videos?limit=100`
  ];
  for (const url of urls) {
    await cache.delete(new Request(url));
  }

  return jsonResponse(request, env, { success: true });
}


