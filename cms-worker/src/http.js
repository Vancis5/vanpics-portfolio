const DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

export function getAllowedOrigins(env, requestUrl) {
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([...DEV_ORIGINS, requestUrl.origin, ...configured]);
}

export function corsHeaders(request, env) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(env, requestUrl);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function jsonResponse(request, env, body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export function emptyCorsResponse(request, env, init = {}) {
  return new Response(null, {
    ...init,
    headers: {
      ...corsHeaders(request, env),
      ...(init.headers || {}),
    },
  });
}

export function errorResponse(request, env, message, status) {
  return jsonResponse(request, env, { error: message }, { status });
}

export async function assertAdmin(request, env) {
  if (!env.ADMIN_SECRET) {
    return { ok: false, status: 503, error: 'admin secret is not configured' };
  }

  const adminToken = request.headers.get('X-Admin-Token');
  if (!adminToken) {
    return { ok: false, status: 401, error: 'unauthorized: invalid admin secret' };
  }

  // Timing-safe comparison using SHA-256 to mitigate timing attacks
  const encoder = new TextEncoder();
  const tokenHash = await crypto.subtle.digest('SHA-256', encoder.encode(adminToken));
  const secretHash = await crypto.subtle.digest('SHA-256', encoder.encode(env.ADMIN_SECRET));

  const tokenArr = new Uint8Array(tokenHash);
  const secretArr = new Uint8Array(secretHash);

  let match = 0;
  for (let i = 0; i < tokenArr.length; i++) {
    match |= tokenArr[i] ^ secretArr[i];
  }

  if (match !== 0) {
    return { ok: false, status: 401, error: 'unauthorized: invalid admin secret' };
  }

  return { ok: true };
}
