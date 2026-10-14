import type { Photo, Video } from '../types.js';

export let photoLibrary: Photo[] = [];

export let motionProjects: Video[] = [];

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
};

function parseDate(item: Photo | Video) {
  if (!item.date) return new Date(0);
  const dateStr = item.date.trim().toLowerCase();
  const matchMDY = dateStr.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (matchMDY && MONTHS[matchMDY[1]] !== undefined) {
    return new Date(parseInt(matchMDY[3], 10), MONTHS[matchMDY[1]], parseInt(matchMDY[2], 10));
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  
  // Year only fallback: "2023" -> Jan 1 of that year
  if (/^\d{4}$/.test(dateStr)) {
    return new Date(`${dateStr}-01-01`);
  }
  return new Date(0);
}

export function updateMediaLibrary(newPhotos: Photo[], newVideos: Video[]) {
  if (Array.isArray(newPhotos) && newPhotos.length > 0) {
    const sortedPhotos = [...newPhotos].sort((a, b) => parseDate(b).getTime() - parseDate(a).getTime());
    photoLibrary.length = 0;
    photoLibrary.push(...sortedPhotos);
  }
  if (Array.isArray(newVideos) && newVideos.length > 0) {
    const filteredVideos = newVideos.filter(v => {
      const t = (v.title || '').toLowerCase().trim();
      if (!t || t === 'untitled') return false;
      return !!v.thumb || !!v.src;
    });
    const sortedVideos = [...filteredVideos].sort((a, b) => parseDate(b).getTime() - parseDate(a).getTime());
    motionProjects.length = 0;
    motionProjects.push(...sortedVideos);
  }
}

export function getCategorySlug(category: string) {
  if (category === 'all') return 'photographs';
  if (category === 'figures') return 'figures';
  return 'motion';
}

export function getInternalCategory(slug: string) {
  if (slug === 'figures') return 'figures';
  if (slug === 'motion') return 'motion';
  return 'all';
}

export function getPhotoLibrary(category: string) {
  if (category === 'motion') return [];
  return photoLibrary.filter(function (photo) {
    const t = (photo.title || '').toLowerCase().trim();
    if (!t || t === 'untitled') return false;
    if (category === 'figures') return photo.category === 'figures';
    return photo.category !== 'figures';
  });
}
