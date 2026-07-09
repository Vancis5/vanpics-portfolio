import { photoLibrary, getPhotoLibrary } from './media-data.js';

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
  activePhotos: [],
  carouselPhotos: getCarouselPhotos(),
  cur: 0,
  isMobile: window.matchMedia('(hover: none)').matches,
  heroVisible: true,
  pageVisible: true,
  heroRafId: null,
  glowRafId: null,
  heroScrollY: 0,
  currentLightboxIsMotion: false,
  isManuallyNavigating: false,
  isTouchingFilmstrip: false,
  fsRaf: null,
  filmstripHideTimer: null,
  lbZoomLevel: 1,
  lbZoomPanX: 0,
  lbZoomPanY: 0,
  lastInputType: 'pointer'
};

export function updateActivePhotos() {
  state.activePhotos = getPhotoLibrary(state.currentCategory);
  return state.activePhotos;
}

updateActivePhotos();

state.carouselPhotos.slice(0, 6).forEach(function (photo) {
  const img = new Image();
  img.src = photo.thumb || photo.src;
});

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', function () {
    state.lastInputType = 'keyboard';
  }, { passive: true });
  window.addEventListener('mousedown', function () {
    state.lastInputType = 'pointer';
  }, { passive: true });
  window.addEventListener('touchstart', function () {
    state.lastInputType = 'pointer';
  }, { passive: true });
}
