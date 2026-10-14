import { corsHeaders, errorResponse, jsonResponse, applyCors, applyPublicMediaCors, publicMediaCorsHeaders } from './http.js';
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
import {
  clearApiCache,
  getMediaObject,
  putMediaObject,
  deleteMediaObjects,
  fetchPhotos,
  fetchVideos,
  findPhotoById,
  findVideoById,
  deletePhotoRecord,
  deleteVideoRecord,
  insertPhotoRecord,
  insertVideoRecord,
  updatePhotoRecord,
  updateVideoRecord,
  updatePhotoMediaKeys,
  getAllPhotosForSorting,
  batchUpdatePhotosCreatedAt,
  getAllVideosForSorting,
  batchUpdateVideosCreatedAt,
} from './media-repository.js';

// 30 MB for images, 100 MB for videos
const MAX_IMAGE_SIZE = 30 * 1024 * 1024;
const MAX_VIDEO_SIZE = 60 * 1024 * 1024;

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
      return applyPublicMediaCors(cachedResponse);
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
        rangeOptions = { suffix: parseInt(endStr, 10) };
      } else {
        const offset = startStr ? parseInt(startStr, 10) : 0;
        if (endStr) {
          rangeOptions = { offset, length: parseInt(endStr, 10) - offset + 1 };
        } else {
          rangeOptions = { offset };
        }
      }
    }
  }

  // 3. Single GET from R2 via repository
  const object = await getMediaObject(env, fileKey, rangeOptions);

  if (!object) {
    return new Response('Media asset not found', {
      status: 404,
      headers: publicMediaCorsHeaders(),
    });
  }

  const totalSize = object.size;
  const headers = new Headers(publicMediaCorsHeaders());
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Accept-Ranges', 'bytes');
  headers.delete('Vary');

  if (!headers.has('Content-Type') || headers.get('Content-Type') === 'application/octet-stream') {
    headers.set('Content-Type', inferContentType(fileKey));
  }

  const contentType = headers.get('Content-Type') || '';
  const isSafeType = contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/');
  if (!isSafeType) {
    headers.set('Content-Disposition', 'attachment');
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

  // 4. Cache full responses at the edge in background
  if (!rangeHeader && request.method === 'GET' && totalSize > 0 && cache) {
    const putPromise = cache.put(cacheKey, response.clone());
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(putPromise);
    }
  }

  return response;
}

export async function listPhotos(request, env, params, ctx) {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url.searchParams);
  const bypassCache = url.searchParams.has('_t');
  const cache = caches.default;
  const canonicalUrl = `${url.origin}${url.pathname}?limit=${limit}&offset=${offset}`;
  const cacheReq = new Request(canonicalUrl, { method: 'GET' });

  if (!bypassCache) {
    const cached = await cache.match(cacheReq);
    if (cached) return applyCors(cached, request, env);
  }

  const { rows, total } = await fetchPhotos(env, limit, offset);
  const items = rows.map((row) => publicPhoto(request, row));

  const body = JSON.stringify({
    items,
    pagination: {
      limit,
      offset,
      total,
      nextOffset: items.length === limit ? offset + limit : null,
    },
  });

  const response = new Response(body, {
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, max-age=0, must-revalidate',
    },
  });

  if (!bypassCache && ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(cacheReq, response.clone()));
  }

  return response;
}

export async function listVideos(request, env, params, ctx) {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url.searchParams);
  const bypassCache = url.searchParams.has('_t');
  const cache = caches.default;
  const canonicalUrl = `${url.origin}${url.pathname}?limit=${limit}&offset=${offset}`;
  const cacheReq = new Request(canonicalUrl, { method: 'GET' });

  if (!bypassCache) {
    const cached = await cache.match(cacheReq);
    if (cached) return applyCors(cached, request, env);
  }

  const { rows, total } = await fetchVideos(env, limit, offset);
  const items = rows.map((row) => publicVideo(request, row));

  const body = JSON.stringify({
    items,
    pagination: {
      limit,
      offset,
      total,
      nextOffset: items.length === limit ? offset + limit : null,
    },
  });

  const response = new Response(body, {
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, max-age=0, must-revalidate',
    },
  });

  if (!bypassCache && ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(cacheReq, response.clone()));
  }

  return response;
}

export async function deletePhoto(request, env, params) {
  const photoId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(photoId) || photoId < 1) {
    return errorResponse(request, env, 'invalid photo id', 400);
  }

  const photo = await findPhotoById(env, photoId);
  if (!photo) {
    return errorResponse(request, env, 'photo not found', 404);
  }

  await deletePhotoRecord(env, photoId);
  await deleteMediaObjects(env, [
    mediaKey(photo.src),
    mediaKey(photo.thumb),
    mediaKey(photo.raw_src),
    mediaKey(photo.lb_src)
  ]);
  await clearApiCache(request);
  return jsonResponse(request, env, { success: true });
}

export async function deleteVideo(request, env, params) {
  const videoId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(videoId) || videoId < 1) {
    return errorResponse(request, env, 'invalid video id', 400);
  }

  const video = await findVideoById(env, videoId);
  if (!video) {
    return errorResponse(request, env, 'video not found', 404);
  }

  await deleteVideoRecord(env, videoId);
  await deleteMediaObjects(env, [mediaKey(video.src), mediaKey(video.poster)]);
  await clearApiCache(request);
  return jsonResponse(request, env, { success: true });
}

export async function uploadPhoto(request, env) {
  const formData = await request.formData();
  const photoFile = formData.get('photo');
  const thumbFile = formData.get('thumb');
  const rawFile = formData.get('raw');
  const lbFile = formData.get('lb');
  const { data, errors } = validatePhotoFields(formData);

  if (!isFileLike(photoFile, 'image/') || !isFileLike(thumbFile, 'image/')) {
    errors.push('missing processed image assets');
  }

  if (lbFile && !isFileLike(lbFile, 'image/')) errors.push('lb field must be a valid image file');
  if (photoFile?.size > MAX_IMAGE_SIZE) errors.push(`photo exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
  if (thumbFile?.size > MAX_IMAGE_SIZE) errors.push(`thumbnail exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
  if (rawFile?.size > MAX_IMAGE_SIZE) errors.push(`raw photo exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
  if (lbFile?.size > MAX_IMAGE_SIZE) errors.push(`lightbox photo exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);

  if (errors.length > 0) {
    return jsonResponse(request, env, { error: 'validation failed', details: errors }, { status: 400 });
  }

  const photoKey = makeMediaKey('photos', 'webp');
  const thumbKey = makeMediaKey('thumbs', 'webp');
  let rawKey = null;
  let lbKey = null;

  const puts = [
    putMediaObject(env, photoKey, await photoFile.arrayBuffer(), { contentType: 'image/webp' }),
    putMediaObject(env, thumbKey, await thumbFile.arrayBuffer(), { contentType: 'image/webp' }),
  ];

  if (rawFile && rawFile.size > 0) {
    const rawExt = extensionForContentType(rawFile.type, 'jpg');
    rawKey = makeMediaKey('photos-raw', rawExt);
    puts.push(
      putMediaObject(env, rawKey, await rawFile.arrayBuffer(), {
        contentType: rawFile.type || 'image/jpeg',
      })
    );
  }

  if (lbFile && lbFile.size > 0) {
    lbKey = makeMediaKey('photos-lb', 'webp');
    puts.push(putMediaObject(env, lbKey, await lbFile.arrayBuffer(), { contentType: 'image/webp' }));
  }

  await Promise.all(puts);

  const result = await insertPhotoRecord(env, {
    title: data.title,
    photoKey,
    thumbKey,
    rawKey,
    lbKey,
    aspectRatio: data.aspectRatio,
    category: data.category,
    location: data.location,
    date: data.date,
    desc: data.desc,
    heroSlide: data.heroSlide,
  });

  await clearApiCache(request);

  return jsonResponse(request, env, {
    success: true,
    photo: publicPhoto(request, {
      id: result.meta.last_row_id,
      title: data.title,
      src: photoKey,
      thumb: thumbKey,
      raw_src: rawKey,
      lb_src: lbKey,
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

  if (videoFile?.size > MAX_VIDEO_SIZE) errors.push(`video exceeds ${MAX_VIDEO_SIZE / 1024 / 1024}MB limit`);
  if (posterFile?.size > MAX_IMAGE_SIZE) errors.push(`poster exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);

  if (errors.length > 0) {
    return jsonResponse(request, env, { error: 'validation failed', details: errors }, { status: 400 });
  }

  const videoExt = extensionForContentType(videoFile.type, 'mp4');
  const videoKey = makeMediaKey('videos', videoExt);
  const posterKey = makeMediaKey('posters', 'webp');

  await Promise.all([
    putMediaObject(env, videoKey, videoFile, { contentType: videoFile.type || 'video/mp4' }),
    putMediaObject(env, posterKey, await posterFile.arrayBuffer(), { contentType: 'image/webp' }),
  ]);

  const result = await insertVideoRecord(env, {
    title: data.title,
    videoKey,
    posterKey,
    aspectRatio: data.aspectRatio,
    location: data.location,
    date: data.date,
    desc: data.desc,
    music: data.music,
  });

  await clearApiCache(request);

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
  
  const title = cleanText(json.title, 'title', errors, { required: false });
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

  const result = await updatePhotoRecord(env, photoId, {
    title,
    category,
    location,
    date,
    desc,
    aspectRatio,
    heroSlide,
  });

  if (result.meta.changes === 0) {
    return errorResponse(request, env, 'photo not found', 404);
  }

  await clearApiCache(request);
  return jsonResponse(request, env, { success: true });
}

export async function updateVideo(request, env, params) {
  const videoId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(videoId) || videoId < 1) {
    return errorResponse(request, env, 'invalid video id', 400);
  }

  const json = await request.json();
  const errors = [];

  const title = cleanText(json.title, 'title', errors, { required: false });
  const location = cleanText(json.location, 'location', errors);
  const date = cleanText(json.date, 'date', errors);
  const desc = cleanText(json.desc, 'desc', errors);
  const aspectRatio = parseAspectRatio(json.aspectRatio, errors);
  const music = cleanText(json.music, 'music', errors, { max: 200 });

  if (errors.length > 0) {
    return jsonResponse(request, env, { error: 'validation failed', details: errors }, { status: 400 });
  }

  const result = await updateVideoRecord(env, videoId, {
    title,
    location,
    date,
    desc,
    aspectRatio,
    music,
  });

  if (result.meta.changes === 0) {
    return errorResponse(request, env, 'video not found', 404);
  }

  await clearApiCache(request);
  return jsonResponse(request, env, { success: true });
}

export async function purgeCache(request, env) {
  const purgedCount = await clearApiCache(request);
  return jsonResponse(request, env, { success: true, purgedCount });
}

export async function sortDatabase(request, env) {
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

  // 1. Sort Photos
  const photos = await getAllPhotosForSorting(env);

  photos.sort((a, b) => {
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

  const baseTime = Date.now();
  const photoUpdates = photos.map((photo, index) => {
    const itemTime = new Date(baseTime - index * 10000);
    const isoString = itemTime.toISOString().replace('T', ' ').substring(0, 19);
    return { id: photo.id, createdAt: isoString };
  });

  await batchUpdatePhotosCreatedAt(env, photoUpdates);

  // 2. Sort Videos
  const videos = await getAllVideosForSorting(env);

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

  const videoUpdates = videos.map((video, index) => {
    const itemTime = new Date(baseTime - index * 10000);
    const isoString = itemTime.toISOString().replace('T', ' ').substring(0, 19);
    return { id: video.id, createdAt: isoString };
  });

  await batchUpdateVideosCreatedAt(env, videoUpdates);

  await clearApiCache(request);

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
  const rawFile = formData.get('raw');
  const lbFile = formData.get('lb');
  const errors = [];
  const aspectRatio = parseAspectRatio(formData.get('aspectRatio'), errors);
  if (!photoFile || !thumbFile) {
    errors.push('missing processed image assets');
  } else {
    if (!isFileLike(photoFile, 'image/')) {
      errors.push('photo field must be a valid image file');
    }
    if (!isFileLike(thumbFile, 'image/')) {
      errors.push('thumb field must be a valid image file');
    }
  }

  if (rawFile && !isFileLike(rawFile, 'image/')) {
    errors.push('raw field must be a valid image file');
  }

  if (lbFile && !isFileLike(lbFile, 'image/')) {
    errors.push('lb field must be a valid image file');
  }

  if (photoFile?.size > MAX_IMAGE_SIZE) errors.push(`photo exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
  if (thumbFile?.size > MAX_IMAGE_SIZE) errors.push(`thumbnail exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
  if (rawFile?.size > MAX_IMAGE_SIZE) errors.push(`raw photo exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
  if (lbFile?.size > MAX_IMAGE_SIZE) errors.push(`lightbox photo exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);

  if (errors.length > 0) {
    return jsonResponse(request, env, { error: 'validation failed', details: errors }, { status: 400 });
  }

  const photo = await findPhotoById(env, photoId);
  if (!photo) {
    return errorResponse(request, env, 'photo record not found', 404);
  }

  const newPhotoKey = makeMediaKey('photos', 'webp');
  const newThumbKey = makeMediaKey('thumbs', 'webp');
  let newRawKey = null;
  let newLbKey = null;

  const puts = [
    putMediaObject(env, newPhotoKey, await photoFile.arrayBuffer(), { contentType: 'image/webp' }),
    putMediaObject(env, newThumbKey, await thumbFile.arrayBuffer(), { contentType: 'image/webp' }),
  ];

  if (rawFile && rawFile.size > 0) {
    const rawExt = extensionForContentType(rawFile.type, 'jpg');
    newRawKey = makeMediaKey('photos-raw', rawExt);
    puts.push(
      putMediaObject(env, newRawKey, await rawFile.arrayBuffer(), {
        contentType: rawFile.type || 'image/jpeg',
      })
    );
  }

  if (lbFile && lbFile.size > 0) {
    newLbKey = makeMediaKey('photos-lb', 'webp');
    puts.push(putMediaObject(env, newLbKey, await lbFile.arrayBuffer(), { contentType: 'image/webp' }));
  }

  await Promise.all(puts);

  await updatePhotoMediaKeys(env, photoId, {
    aspectRatio,
    photoKey: newPhotoKey,
    thumbKey: newThumbKey,
    rawKey: newRawKey,
    lbKey: newLbKey,
  });

  await deleteMediaObjects(env, [
    mediaKey(photo.src),
    mediaKey(photo.thumb),
    mediaKey(photo.raw_src),
    mediaKey(photo.lb_src),
  ]);
  await clearApiCache(request);

  return jsonResponse(request, env, { success: true });
}

export async function handleViewCount(request, env) {
  if (!env.COUNTER_DO) {
    return errorResponse(request, env, 'durable object binding missing', 500);
  }
  const id = env.COUNTER_DO.idFromName('global-counter');
  const stub = env.COUNTER_DO.get(id);

  const doRes = await stub.fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  const data = await doRes.json();
  return jsonResponse(request, env, data);
}
