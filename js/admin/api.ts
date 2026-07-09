import { API_BASE_URL } from './utils.js';

export async function fetchArchives() {
  const [photosRes, videosRes] = await Promise.all([
    fetch(`${API_BASE_URL}/api/photos?limit=500&_t=${Date.now()}`),
    fetch(`${API_BASE_URL}/api/videos?limit=500&_t=${Date.now()}`)
  ]);

  if (!photosRes.ok || !videosRes.ok) throw new Error('API server down');

  const photos = await photosRes.json();
  const videos = await videosRes.json();

  return {
    photos: Array.isArray(photos) ? photos : photos.items || [],
    videos: Array.isArray(videos) ? videos : videos.items || []
  };
}

export async function deleteArchiveItem(type, id, token) {
  const endpoint = type === 'video' 
    ? `${API_BASE_URL}/api/admin/video/${id}`
    : `${API_BASE_URL}/api/admin/photo/${id}`;

  const res = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'X-Admin-Token': token
    }
  });
  
  return res;
}

export async function updateArchiveItem(type, id, payload, token) {
  const endpoint = type === 'photo'
    ? `${API_BASE_URL}/api/admin/photo/${id}`
    : `${API_BASE_URL}/api/admin/video/${id}`;

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': token
    },
    body: JSON.stringify(payload)
  });

  return res;
}

export async function uploadArchiveItem(type, formData, token) {
  const endpoint = type === 'photo'
    ? `${API_BASE_URL}/api/admin/upload-photo`
    : `${API_BASE_URL}/api/admin/upload-video`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Admin-Token': token
    },
    body: formData
  });

  return res;
}

export async function replacePhotoItem(id, formData, token) {
  const endpoint = `${API_BASE_URL}/api/admin/photo/${id}/replace`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Admin-Token': token
    },
    body: formData
  });
  return res;
}

