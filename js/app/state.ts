import type { Photo } from '../types.js';
import { photoLibrary, getPhotoLibrary } from './media-data.js';
import { photoColorMap, photoTitleColorMap } from '../data/photo-colors.js';

function getInitialCategory() {
  if (!window.location.hash) return 'all';
  const initialHash = window.location.hash.substring(1).split('/')[0];
  if (initialHash === 'figures') return 'figures';
  if (initialHash === 'motion') return 'motion';
  return 'all';
}

function getCarouselPhotos() {
  const heroPhotos = photoLibrary.filter(function (photo) {
    return photo.heroSlide === true && photo.title !== '';
  });
  if (heroPhotos.length > 0) return heroPhotos;
  return photoLibrary.filter(function (photo) { return photo.title !== ''; });
}

export const state = {
  pushNextState: false,
  isPopState: false,
  currentCategory: getInitialCategory(),
  selectedColor: null as string | null,
  activePhotos: [] as Photo[],
  carouselPhotos: getCarouselPhotos() as Photo[],
  cur: 0,
  isMobile: window.matchMedia('(hover: none)').matches,
  heroVisible: true,
  pageVisible: true,
  heroRafId: null as number | null,
  glowRafId: null as number | null,
  heroScrollY: 0,
  currentLightboxIsMotion: false,
  isManuallyNavigating: false,
  isTouchingFilmstrip: false,
  fsRaf: null as number | null,
  filmstripHideTimer: null as any,
  lbZoomLevel: 1,
  lbZoomPanX: 0,
  lbZoomPanY: 0,
  lastInputType: 'pointer'
};

export function getPhotoColor(photo: Photo): string | undefined {
  if (!photo) return undefined;
  if (photo.src && photoColorMap[photo.src]) return photoColorMap[photo.src];
  if (photo.src) {
    const filename = photo.src.substring(photo.src.lastIndexOf('/') + 1);
    if (photoColorMap[filename]) return photoColorMap[filename];
  }
  if (photo.thumb) {
    const thumbFilename = photo.thumb.substring(photo.thumb.lastIndexOf('/') + 1);
    if (photoColorMap[thumbFilename]) return photoColorMap[thumbFilename];
  }
  if (photo.title) {
    const cleanTitle = photo.title.toLowerCase().trim();
    if (photoTitleColorMap[cleanTitle]) return photoTitleColorMap[cleanTitle];
  }
  return undefined;
}

export function updateActivePhotos() {
  let photos = getPhotoLibrary(state.currentCategory);
  if (state.selectedColor) {
    photos = photos.filter(p => getPhotoColor(p) === state.selectedColor);
  }
  state.activePhotos = photos;
  return state.activePhotos;
}

updateActivePhotos();

state.carouselPhotos.slice(0, 6).forEach(function (photo) {
  const img = new Image();
  img.src = photo.thumb || photo.src;
});

window.addEventListener('keydown', function () {
  state.lastInputType = 'keyboard';
}, { passive: true });
window.addEventListener('mousedown', function () {
  state.lastInputType = 'pointer';
}, { passive: true });
window.addEventListener('touchstart', function () {
  state.lastInputType = 'pointer';
}, { passive: true });
