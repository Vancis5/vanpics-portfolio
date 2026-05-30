export function getAllowedOrigins(env) {
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(configured);
}

export function isOriginAllowed(origin, env) {
  if (!origin) return false;
  
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return true;
    }
  } catch (e) {}

  const allowed = getAllowedOrigins(env);
  return allowed.has(origin);
}

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin && isOriginAllowed(origin, env)) {
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
    return { ok: false, status: 401, error: 'unauthorized: missing admin token' };
  }

  // Reject tokens that are unreasonably long (> 512 chars) to avoid hash-DoS
  if (adminToken.length > 512) {
    return { ok: false, status: 401, error: 'unauthorized: invalid admin token' };
  }

  // Timing-safe comparison using SHA-256 to mitigate timing attacks
  const encoder = new TextEncoder();
  const [tokenHash, secretHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(adminToken)),
    crypto.subtle.digest('SHA-256', encoder.encode(env.ADMIN_SECRET)),
  ]);

  const tokenArr = new Uint8Array(tokenHash);
  const secretArr = new Uint8Array(secretHash);

  let mismatch = 0;
  for (let i = 0; i < tokenArr.length; i++) {
    mismatch |= tokenArr[i] ^ secretArr[i];
  }

  if (mismatch !== 0) {
    return { ok: false, status: 401, error: 'unauthorized: invalid admin token' };
  }

  return { ok: true };
}
