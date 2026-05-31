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
  if (key.includes('..') || key.startsWith('/') || key.startsWith('\\')) return false;
  // Only allow alphanumeric, hyphens, underscores, dots, and forward slashes
  return /^[a-zA-Z0-9\-_./]+$/.test(key);
}

export async function serveMedia(request, env, params) {
  const fileKey = decodeURIComponent(params.key);

  if (!isValidMediaKey(fileKey)) {
    return new Response('Invalid media key', {
      status: 400,
      headers: corsHeaders(request, env),
    });
  }

  const rangeHeader = request.headers.get('Range');

  // 1. Try to fetch from the Cloudflare CDN edge cache first (only for non-range requests)
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

  // 2. Fallback to fetching from R2 bucket (supporting range slices)
  const getOptions = {};
  if (rangeHeader) {
    getOptions.range = request.headers;
  }

  const object = await env.MEDIA_BUCKET.get(fileKey, getOptions);

  if (!object) {
    return new Response('Media asset not found', {
      status: 404,
      headers: corsHeaders(request, env),
    });
  }

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

  const status = rangeHeader && object.range ? 206 : 200;

  if (status === 206 && object.range) {
    const start = object.range.offset;
    const length = object.range.length;
    const end = start + length - 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    headers.set('Content-Length', length.toString());
  } else {
    headers.set('Content-Length', object.size.toString());
  }

  const response = new Response(object.body, { status, headers });

  // 3. Cache the served response in background for future requests (only for full 200 OK responses)
  if (!rangeHeader && request.method === 'GET' && object.size > 0 && cache) {
    const putPromise = cache.put(cacheKey, response.clone());
    if (env.waitUntil) {
      env.waitUntil(putPromise);
    } else {
      await putPromise;
    }
  }

  return response;
}

export async function listPhotos(request, env) {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url.searchParams);
  const { results } = await env.DB.prepare(
    `SELECT id, title, src, thumb, blur, aspect_ratio, category, location, date, desc, hero_slide, created_at
     FROM photos
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  const totalRow = await env.DB.prepare('SELECT COUNT(*) AS total FROM photos').first();
  const items = results.map((row) => publicPhoto(request, row));

  return jsonResponse(request, env, {
    items,
    pagination: {
      limit,
      offset,
      total: totalRow?.total || 0,
      nextOffset: items.length === limit ? offset + limit : null,
    },
  });
}

export async function listVideos(request, env) {
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

  return jsonResponse(request, env, {
    items,
    pagination: {
      limit,
      offset,
      total: totalRow?.total || 0,
      nextOffset: items.length === limit ? offset + limit : null,
    },
  });
}

export async function deletePhoto(request, env, params) {
  const photoId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(photoId) || photoId < 1) {
    return errorResponse(request, env, 'invalid photo id', 400);
  }

  const photo = await env.DB.prepare('SELECT src, thumb, blur FROM photos WHERE id = ?')
    .bind(photoId)
    .first();

  if (!photo) {
    return errorResponse(request, env, 'photo not found', 404);
  }

  const keysToDelete = [mediaKey(photo.src), mediaKey(photo.thumb), mediaKey(photo.blur)].filter(Boolean);
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
  const blurFile = formData.get('blur');
  const { data, errors } = validatePhotoFields(formData);

  if (!isFileLike(photoFile, 'image/') || !isFileLike(thumbFile, 'image/') || !isFileLike(blurFile, 'image/')) {
    errors.push('missing processed image assets');
  }

  // Enforce file size limits
  if (photoFile?.size > MAX_IMAGE_SIZE) errors.push(`photo exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
  if (thumbFile?.size > MAX_IMAGE_SIZE) errors.push(`thumbnail exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
  if (blurFile?.size > MAX_IMAGE_SIZE) errors.push(`blur exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);

  if (errors.length > 0) {
    return jsonResponse(request, env, { error: 'validation failed', details: errors }, { status: 400 });
  }

  const photoKey = makeMediaKey('photos', 'webp');
  const thumbKey = makeMediaKey('thumbs', 'webp');
  const blurKey = makeMediaKey('blur', 'webp');

  await Promise.all([
    env.MEDIA_BUCKET.put(photoKey, await photoFile.arrayBuffer(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    }),
    env.MEDIA_BUCKET.put(thumbKey, await thumbFile.arrayBuffer(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    }),
    env.MEDIA_BUCKET.put(blurKey, await blurFile.arrayBuffer(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    }),
  ]);

  const result = await env.DB.prepare(
    `INSERT INTO photos (title, src, thumb, blur, aspect_ratio, category, location, date, desc, hero_slide)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      data.title,
      photoKey,
      thumbKey,
      blurKey,
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
      blur: blurKey,
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

