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
  lbZoomPanY: 0
};

export function updateActivePhotos() {
  state.activePhotos = getPhotoLibrary(state.currentCategory);
  return state.activePhotos;
}

updateActivePhotos();

state.carouselPhotos.slice(0, 6).forEach(function (photo) {
  const img = new Image();
  img.src = photo.src;
});

if (typeof window !== 'undefined') {
  window.appState = state;
  window.updateActivePhotos = updateActivePhotos;

  [
    'pushNextState',
    'isPopState',
    'currentCategory',
    'activePhotos',
    'carouselPhotos',
    'cur',
    'isMobile',
    'heroVisible',
    'pageVisible',
    'heroRafId',
    'glowRafId',
    'heroScrollY',
    'currentLightboxIsMotion',
    'isManuallyNavigating',
    'isTouchingFilmstrip',
    'fsRaf',
    'filmstripHideTimer',
    'lbZoomLevel',
    'lbZoomPanX',
    'lbZoomPanY'
  ].forEach(function (key) {
    Object.defineProperty(window, key, {
      get: function () { return state[key]; },
      set: function (value) { state[key] = value; },
      configurable: true
    });
  });
}
