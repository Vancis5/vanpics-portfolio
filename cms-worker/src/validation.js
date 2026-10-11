const TEXT_LIMITS = {
  title: 120,
  date: 64,
  location: 120,
  category: 40,
  desc: 1000,
};

export const ALLOWED_CATEGORIES = new Set(['', 'figures']);

export function sanitizeDesc(str) {
  if (!str) return '';
  return String(str)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<(?!\/?(?:br|a)\b)[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

export function cleanText(value, fieldName, errors, options = {}) {
  // eslint-disable-next-line security/detect-object-injection
  const max = options.max || TEXT_LIMITS[fieldName] || 255;
  const required = Boolean(options.required);
  let text = String(value || '').trim();

  if (fieldName === 'desc') {
    text = sanitizeDesc(text);
  } else {
    text = text.replace(/\s+/g, ' ');
  }

  if (required && !text) {
    errors.push(`${fieldName} is required`);
  }

  if (text.length > max) {
    errors.push(`${fieldName} must be ${max} characters or less`);
  }

  return text;
}

export function parseAspectRatio(value, errors) {
  const aspectRatio = Number.parseFloat(value);
  if (!Number.isFinite(aspectRatio) || aspectRatio < 0.1 || aspectRatio > 10) {
    errors.push('aspectRatio must be between 0.1 and 10');
    return 1;
  }

  return Number(aspectRatio.toFixed(4));
}

export function validatePhotoFields(formData) {
  const errors = [];
  const category = cleanText(formData.get('category'), 'category', errors);

  if (!ALLOWED_CATEGORIES.has(category)) {
    errors.push('category is not supported');
  }

  return {
    data: {
      title: cleanText(formData.get('title'), 'title', errors, { required: false }),
      date: cleanText(formData.get('date'), 'date', errors),
      location: cleanText(formData.get('location'), 'location', errors),
      category,
      desc: cleanText(formData.get('desc'), 'desc', errors),
      aspectRatio: parseAspectRatio(formData.get('aspectRatio'), errors),
      heroSlide: formData.get('heroSlide') === 'true' ? 1 : 0,
    },
    errors,
  };
}

export function validateVideoFields(formData) {
  const errors = [];

  return {
    data: {
      title: cleanText(formData.get('title'), 'title', errors, { required: false }),
      date: cleanText(formData.get('date'), 'date', errors),
      location: cleanText(formData.get('location'), 'location', errors),
      desc: cleanText(formData.get('desc'), 'desc', errors),
      aspectRatio: parseAspectRatio(formData.get('aspectRatio'), errors),
      music: cleanText(formData.get('music'), 'music', errors, { max: 200 }),
    },
    errors,
  };
}

export function isFileLike(value, prefix) {
  return value && typeof value.arrayBuffer === 'function' && String(value.type || '').startsWith(prefix);
}

export function parsePagination(searchParams) {
  const limit = Math.min(Math.max(Number.parseInt(searchParams.get('limit') || '50', 10), 1), 500);
  const offset = Math.max(Number.parseInt(searchParams.get('offset') || '0', 10), 0);

  return { limit, offset };
}
