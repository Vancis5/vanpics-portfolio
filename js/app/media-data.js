export let photoLibrary = [];

export let motionProjects = [];

function parseDate(item) {
  if (!item.date) return new Date(0);
  const dateStr = item.date.trim().toLowerCase();
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  
  // Year only fallback: "2023" -> Jan 1 of that year
  if (/^\d{4}$/.test(dateStr)) {
    return new Date(`${dateStr}-01-01`);
  }
  return new Date(0);
}

export function updateMediaLibrary(newPhotos, newVideos) {
  if (Array.isArray(newPhotos) && newPhotos.length > 0) {
    const sortedPhotos = [...newPhotos].sort((a, b) => parseDate(b) - parseDate(a));
    photoLibrary.length = 0;
    photoLibrary.push(...sortedPhotos);
  }
  if (Array.isArray(newVideos) && newVideos.length > 0) {
    const filteredVideos = newVideos.filter(v => {
      const t = (v.title || '').toLowerCase().trim();
      if (!t || t === 'untitled') return false;
      return !!v.thumb || !!v.src;
    });
    const sortedVideos = [...filteredVideos].sort((a, b) => parseDate(b) - parseDate(a));
    motionProjects.length = 0;
    motionProjects.push(...sortedVideos);
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
    const t = (photo.title || '').toLowerCase().trim();
    if (!t || t === 'untitled') return false;
    if (category === 'figures') return photo.category === 'figures';
    return photo.category !== 'figures';
  });
}
