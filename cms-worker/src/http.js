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
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token, Range',
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
function base64UrlEncode(str) {
  return btoa(str)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

// Generate JWT signature natively with HMAC SHA-256
async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const headerStr = base64UrlEncode(JSON.stringify(header));
  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = encoder.encode(`${headerStr}.${payloadStr}`);
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, dataToSign);
  const signatureStr = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  
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
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const sigBinary = base64UrlDecode(signatureStr);
    const sigArr = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      sigArr[i] = sigBinary.charCodeAt(i);
    }
    
    const isValid = await crypto.subtle.verify('HMAC', key, sigArr, dataToVerify);
    if (!isValid) return null;
    
    return JSON.parse(base64UrlDecode(payloadStr));
  } catch (e) {
    return null;
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
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const lockoutTime = 15 * 60 * 1000; // 15 minutes

  if (env.DB) {
    try {
      const record = await env.DB.prepare(
        'SELECT attempts, last_attempt FROM rate_limits WHERE ip = ?'
      ).bind(ip).first();

      if (record) {
        if (record.attempts >= 5 && (now - record.last_attempt) < lockoutTime) {
          const remainingSec = Math.ceil((lockoutTime - (now - record.last_attempt)) / 1000);
          return { ok: false, status: 429, error: `too many login attempts. try again in ${remainingSec} seconds.` };
        }
      }
    } catch (dbErr) {
      console.error('Rate limit select error:', dbErr);
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
      try {
        await env.DB.prepare(
          `INSERT INTO rate_limits (ip, attempts, last_attempt)
           VALUES (?, 1, ?)
           ON CONFLICT(ip) DO UPDATE SET
             attempts = CASE WHEN (? - last_attempt) > ? THEN 1 ELSE attempts + 1 END,
             last_attempt = ?`
        ).bind(ip, now, now, lockoutTime, now).run();
      } catch (dbErr) {
        console.error('Rate limit increment error:', dbErr);
      }
    }
    return { ok: false, status: 401, error: 'unauthorized: invalid admin token' };
  }

  // Success! Clear/reset attempts on successful login
  if (env.DB) {
    try {
      await env.DB.prepare('DELETE FROM rate_limits WHERE ip = ?').bind(ip).run();
    } catch (dbErr) {
      console.error('Rate limit delete error:', dbErr);
    }
  }

  // Correct master password! Issue a secure signed JWT valid for 24 hours (expiry in seconds)
  const payload = {
    sub: 'admin',
    exp: Math.floor(now / 1000) + 24 * 60 * 60
  };
  const jwt = await signJWT(payload, jwtSecret);

  return { ok: true, token: jwt };
}
