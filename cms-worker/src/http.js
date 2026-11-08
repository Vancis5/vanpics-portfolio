export function getAllowedOrigins(env) {
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(configured);
}

export function isOriginAllowed(origin, env) {
  if (!origin) return false;

  const allowed = getAllowedOrigins(env);
  if (allowed.has(origin)) return true;

  try {
    const url = new URL(origin);
    const { hostname, protocol } = url;
    if (protocol === 'https:' && (hostname === 'vanpics.pages.dev' || hostname.endsWith('.vanpics.pages.dev'))) {
      return true;
    }
  } catch {
    return false;
  }

  if (env.ENVIRONMENT !== 'production') {
    try {
      const url = new URL(origin);
      const { hostname, protocol } = url;
      if (protocol === 'http:' || protocol === 'https:') {
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.endsWith('.local') ||
          /^192\.168\.\d+\.\d+$/.test(hostname) ||
          /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(hostname)
        ) {
          return true;
        }
      }
    } catch {
      return false;
    }
  }

  return false;
}

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token, X-Remember, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    // Override Cloudflare's injected Permissions-Policy to suppress browser warnings
    // about unrecognized privacy sandbox / ad-auction features
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  if (origin && isOriginAllowed(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function publicMediaCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

export function applyPublicMediaCors(response) {
  const headers = new Headers(response.headers);
  const cors = publicMediaCorsHeaders();
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  headers.delete('Vary');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function applyCors(response, request, env) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request, env);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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

// Base64Url helpers for native Web Crypto signature encoding
function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecodeBytes(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncodeJson(obj) {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

function base64UrlDecodeJson(str) {
  return JSON.parse(new TextDecoder().decode(base64UrlDecodeBytes(str)));
}

// Generate JWT signature natively with HMAC SHA-256
async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const headerStr = base64UrlEncodeJson(header);
  const payloadStr = base64UrlEncodeJson(payload);
  const dataToSign = encoder.encode(`${headerStr}.${payloadStr}`);
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, dataToSign);
  const signatureStr = base64UrlEncodeBytes(new Uint8Array(signature));
  
  return `${headerStr}.${payloadStr}.${signatureStr}`;
}

// Verify JWT signature natively with HMAC SHA-256
async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [headerStr, payloadStr, signatureStr] = parts;
  const encoder = new TextEncoder();
  const dataToVerify = encoder.encode(`${headerStr}.${payloadStr}`);
  
  try {
    const header = base64UrlDecodeJson(headerStr);
    if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const sigArr = base64UrlDecodeBytes(signatureStr);
    
    const isValid = await crypto.subtle.verify('HMAC', key, sigArr, dataToVerify);
    if (!isValid) return null;
    
    return base64UrlDecodeJson(payloadStr);
  } catch (e) {
    return null;
  }
}

let authSchemaEnsured = false;
export async function ensureAuthSchema(db) {
  if (authSchemaEnsured || !db) return;
  try {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS rate_limits (ip TEXT PRIMARY KEY, attempts INTEGER DEFAULT 0, last_attempt INTEGER)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS auth_logs (id TEXT PRIMARY KEY, ip_address TEXT, action TEXT NOT NULL, details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_logs_created ON auth_logs(created_at)`)
    ]);
    authSchemaEnsured = true;
  } catch (err) {
    console.error('ensureAuthSchema error:', err);
    authSchemaEnsured = true;
  }
}

export async function checkRateLimit(db, ip, lockoutMs = 15 * 60 * 1000, maxAttempts = 5) {
  if (!db || !ip) return { allowed: true };
  const now = Date.now();
  try {
    const row = await db.prepare(
      `SELECT attempts, last_attempt FROM rate_limits WHERE ip = ?`
    ).bind(ip).first();

    if (row && row.attempts >= maxAttempts) {
      const elapsed = now - row.last_attempt;
      if (elapsed < lockoutMs) {
        const remainingSec = Math.ceil((lockoutMs - elapsed) / 1000);
        return { allowed: false, remainingSec };
      }
    }
  } catch (err) {
    console.error('checkRateLimit error:', err);
  }
  return { allowed: true };
}

export async function recordLoginAttempt(db, ip, success, lockoutMs = 15 * 60 * 1000) {
  if (!db || !ip) return;
  const now = Date.now();
  try {
    if (success) {
      await db.prepare(`DELETE FROM rate_limits WHERE ip = ?`).bind(ip).run();
    } else {
      await db.prepare(`
        INSERT INTO rate_limits (ip, attempts, last_attempt)
        VALUES (?, 1, ?)
        ON CONFLICT(ip) DO UPDATE SET
          attempts = CASE WHEN (? - last_attempt) > ? THEN 1 ELSE attempts + 1 END,
          last_attempt = ?
      `).bind(ip, now, now, lockoutMs, now).run();
    }
  } catch (err) {
    console.error('recordLoginAttempt error:', err);
  }
}

export async function logAuthEvent(db, ip, action, details) {
  if (!db) return;
  try {
    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO auth_logs (id, ip_address, action, details, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(id, ip || 'unknown', action, details || null).run();
  } catch (err) {
    console.error('logAuthEvent error:', err);
  }
}

export async function assertAdmin(request, env) {
  if (!env.ADMIN_SECRET) {
    return { ok: false, status: 503, error: 'admin secret is not configured' };
  }

  const adminToken = request.headers.get('X-Admin-Token');
  if (!adminToken) {
    return { ok: false, status: 401, error: 'unauthorized: missing admin token' };
  }

  // Reject tokens that are unreasonably long to avoid hash-DoS
  if (adminToken.length > 512) {
    return { ok: false, status: 401, error: 'unauthorized: invalid admin token' };
  }

  const jwtSecret = env.JWT_SECRET || env.ADMIN_SECRET;

  // 1. If it's a JWT, verify the signature & expiry
  const parts = adminToken.split('.');
  if (parts.length === 3) {
    const payload = await verifyJWT(adminToken, jwtSecret);
    if (payload && payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
      return { ok: true, token: adminToken };
    }
  }

  // 2. Otherwise, check if it's the raw master password (Timing-safe comparison using SHA-256)
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    '127.0.0.1';
  const now = Date.now();
  const lockoutTime = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  if (env.DB) {
    await ensureAuthSchema(env.DB);
    const rateLimit = await checkRateLimit(env.DB, ip, lockoutTime, maxAttempts);
    if (!rateLimit.allowed) {
      await logAuthEvent(env.DB, ip, 'rate_limited', `Locked out for ${rateLimit.remainingSec}s`);
      return {
        ok: false,
        status: 429,
        error: `too many login attempts. security lockout active for ${rateLimit.remainingSec} seconds.`
      };
    }
  }

  const encoder = new TextEncoder();
  const [tokenHash, secretHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(adminToken)),
    crypto.subtle.digest('SHA-256', encoder.encode(env.ADMIN_SECRET)),
  ]);

  const tokenArr = new Uint8Array(tokenHash);
  const secretArr = new Uint8Array(secretHash);

  let mismatch = 0;
  for (let i = 0; i < tokenArr.length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    mismatch |= tokenArr[i] ^ secretArr[i];
  }

  if (mismatch !== 0) {
    if (env.DB) {
      await recordLoginAttempt(env.DB, ip, false, lockoutTime);
      await logAuthEvent(env.DB, ip, 'login_failed', 'invalid admin token attempt');
    }
    return { ok: false, status: 401, error: 'unauthorized: invalid admin token' };
  }

  // Success! Clear/reset attempts on successful login
  if (env.DB) {
    await recordLoginAttempt(env.DB, ip, true);
    await logAuthEvent(env.DB, ip, 'login_success', 'authenticated as admin');
  }

  // Correct master password! Issue a secure signed JWT
  // Remember token: 30 days vs 24 hours (matching BIDTRACK)
  let isRemember = request.headers.get('X-Remember') === 'true';
  if (!isRemember) {
    try {
      const url = new URL(request.url);
      isRemember = url.searchParams.get('remember') === 'true' || url.searchParams.get('remember') === '1';
    } catch {}
  }
  const durationSeconds = isRemember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;

  const payload = {
    sub: 'admin',
    exp: Math.floor(now / 1000) + durationSeconds
  };
  const jwt = await signJWT(payload, jwtSecret);

  return { ok: true, token: jwt };
}
