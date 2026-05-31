import { assertAdmin, emptyCorsResponse, errorResponse, jsonResponse } from './http.js';
import {
  deletePhoto,
  deleteVideo,
  listPhotos,
  listVideos,
  serveMedia,
  uploadPhoto,
  uploadVideo,
  updatePhoto,
  updateVideo,
  purgeCache,
  sortDatabase,
} from './handlers.js';

const ROUTES = [
  { method: 'GET', pattern: /^\/media\/(?<key>.+)$/, handler: serveMedia, public: true },
  { method: 'GET', pattern: /^\/api\/photos$/, handler: listPhotos, public: true },
  { method: 'GET', pattern: /^\/api\/videos$/, handler: listVideos, public: true },
  { method: 'GET', pattern: /^\/api\/admin\/verify$/, handler: async (request, env) => jsonResponse(request, env, { success: true, token: request.auth?.token }) },
  { method: 'DELETE', pattern: /^\/api\/admin\/photo\/(?<id>\d+)$/, handler: deletePhoto },
  { method: 'DELETE', pattern: /^\/api\/admin\/video\/(?<id>\d+)$/, handler: deleteVideo },
  { method: 'PUT', pattern: /^\/api\/admin\/photo\/(?<id>\d+)$/, handler: updatePhoto },
  { method: 'PUT', pattern: /^\/api\/admin\/video\/(?<id>\d+)$/, handler: updateVideo },
  { method: 'POST', pattern: /^\/api\/admin\/upload-photo$/, handler: uploadPhoto },
  { method: 'POST', pattern: /^\/api\/admin\/upload-video$/, handler: uploadVideo },
  { method: 'POST', pattern: /^\/api\/admin\/purge-cache$/, handler: purgeCache },
  { method: 'POST', pattern: /^\/api\/admin\/sort-db$/, handler: sortDatabase },
];

function matchRoute(method, pathname) {
  for (const route of ROUTES) {
    if (route.method !== method) continue;

    const match = route.pattern.exec(pathname);
    if (match) {
      return { route, params: match.groups || {} };
    }
  }

  return null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return emptyCorsResponse(request, env);
    }

    const url = new URL(request.url);
    const match = matchRoute(request.method, url.pathname);

    if (!match) {
      return errorResponse(request, env, 'endpoint not found', 404);
    }

    const { route, params } = match;

    if (!route.public) {
      const auth = await assertAdmin(request, env);
      if (!auth.ok) {
        return errorResponse(request, env, auth.error, auth.status);
      }
      request.auth = auth;
    }

    try {
      return await route.handler(request, env, params);
    } catch (err) {
      return errorResponse(request, env, err.message || 'internal server error', 500);
    }
  },
};
