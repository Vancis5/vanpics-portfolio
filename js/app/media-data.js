import { photos } from '../data/photos.js';
import { videos } from '../data/videos.js';

export let photoLibrary = Array.isArray(photos) ? [...photos] : [];

export let motionProjects = (Array.isArray(videos) ? [...videos] : []).filter(function (video) {
  return !!video.thumb || !!video.src;
});

export function updateMediaLibrary(newPhotos, newVideos) {
  if (Array.isArray(newPhotos) && newPhotos.length > 0) {
    photoLibrary.length = 0;
    photoLibrary.push(...newPhotos);
  }
  if (Array.isArray(newVideos) && newVideos.length > 0) {
    motionProjects.length = 0;
    motionProjects.push(...newVideos.filter(v => !!v.thumb || !!v.src));
  }
}

export function getCategorySlug(category) {
  if (category === 'all') return 'photographs';
  if (category === 'figures') return 'figures';
  return 'motion';
}

export function getInternalCategory(slug) {
  if (slug === 'figures') return 'figures';
  if (slug === 'motion') return 'motion';
  return 'all';
}

export function getPhotoLibrary(category) {
  if (category === 'motion') return [];
  return photoLibrary.filter(function (photo) {
    if (!photo.title) return false;
    if (category === 'figures') return photo.category === 'figures';
    return photo.category !== 'figures';
  });
}
