import { photos } from '../../data/photos.js';
import { videos } from '../../data/videos.js';

export const photoLibrary = Array.isArray(photos) ? photos : [];

export const motionProjects = (Array.isArray(videos) ? videos : []).filter(function (video) {
  return !!video.thumb || !!video.src;
});

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

if (typeof window !== 'undefined') {
  window.photoLibrary = photoLibrary;
  window.motionProjects = motionProjects;
  window.getCategorySlug = getCategorySlug;
  window.getInternalCategory = getInternalCategory;
  window.getPhotoLibrary = getPhotoLibrary;
}
