export function mediaUrl(request, keyOrUrl) {
  if (!keyOrUrl) return '';

  try {
    const parsed = new URL(keyOrUrl);
    if (parsed.pathname.startsWith('/media/')) {
      return `${new URL(request.url).origin}${parsed.pathname}`;
    }
    return keyOrUrl;
  } catch {
    return `${new URL(request.url).origin}/media/${encodeURI(keyOrUrl)}`;
  }
}

export function mediaKey(keyOrUrl) {
  if (!keyOrUrl) return null;

  try {
    const parsed = new URL(keyOrUrl);
    if (parsed.pathname.startsWith('/media/')) {
      return decodeURIComponent(parsed.pathname.slice('/media/'.length));
    }
    return null;
  } catch {
    return keyOrUrl;
  }
}

export function publicPhoto(request, row) {
  return {
    ...row,
    src: mediaUrl(request, row.src),
    thumb: mediaUrl(request, row.thumb),
    raw_src: row.raw_src ? mediaUrl(request, row.raw_src) : null,
  };
}

export function publicVideo(request, row) {
  return {
    ...row,
    src: mediaUrl(request, row.src),
    poster: mediaUrl(request, row.poster),
  };
}

export function inferContentType(fileKey) {
  if (fileKey.endsWith('.webp')) return 'image/webp';
  if (fileKey.endsWith('.mp4')) return 'video/mp4';
  if (fileKey.endsWith('.webm')) return 'video/webm';
  if (fileKey.endsWith('.mov')) return 'video/quicktime';
  return 'application/octet-stream';
}

export function extensionForContentType(contentType, fallback) {
  const cleanType = (contentType || '').split(';')[0].toLowerCase();
  const extensions = {
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };

  return extensions[cleanType] || fallback;
}

export function makeMediaKey(folder, extension) {
  return `${folder}/${crypto.randomUUID()}.${extension}`;
}
