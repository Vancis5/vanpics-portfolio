import {
  openLightbox,
  closeLightbox,
  navigateLightbox,
  loadSwipeNeighbors,
  setMobileScrollHandler
} from './controller.js';

import {
  getCurrentLightboxItems,
  setLightboxBlur,
  setLightboxContent,
  animateInfo,
  updateMobileImgWrapHeight,
  measureFilmstripTopOffset,
  initBlurRenderer,
  preloadLightboxBlurNeighbors,
  scheduleLightboxBlurNeighborPreload,
  toggleLightboxDesc,
  collapseLightboxDesc,
  resetDescToggle,
  cancelDescFlipTransition,
  updateLightboxDescPreview,
  refreshLightboxInfoRefs,
  cancelPendingHashUpdate,
  clearLightboxPhotoMask,
  updateLightboxPhotoMask
} from './renderer.js';

import {
  prepareLightboxPhoto,
  renderVideoInLightbox,
  startUnifiedMotionPlayer,
  clearLightboxPhotoPlaceholder,
  fadeOutMotionVideo,
  fadeOutAndKillMotionVideo,
  killMotionPlayer,
  initMotionSwipeVolume,
  updateMotionSwipeVolume,
  restoreMotionSwipeVolume
} from '../lightbox-media.js';

import {
  getLightboxLayout,
  updateLightboxLayout,
  type LbLayout
} from './layout.js';

import type { LightboxFacade } from './types.js';

// Unified 4-method facade
export const lightbox: LightboxFacade = {
  open: openLightbox,
  close: closeLightbox,
  next: () => navigateLightbox(1),
  prev: () => navigateLightbox(-1)
};

// Re-exports for public compatibility across codebase
export {
  openLightbox,
  closeLightbox,
  navigateLightbox,
  loadSwipeNeighbors,
  setMobileScrollHandler,
  getCurrentLightboxItems,
  setLightboxBlur,
  setLightboxContent,
  animateInfo,
  updateMobileImgWrapHeight,
  measureFilmstripTopOffset,
  initBlurRenderer,
  preloadLightboxBlurNeighbors,
  scheduleLightboxBlurNeighborPreload,
  toggleLightboxDesc,
  collapseLightboxDesc,
  resetDescToggle,
  cancelDescFlipTransition,
  updateLightboxDescPreview,
  refreshLightboxInfoRefs,
  cancelPendingHashUpdate,
  prepareLightboxPhoto,
  renderVideoInLightbox,
  startUnifiedMotionPlayer,
  clearLightboxPhotoPlaceholder,
  fadeOutMotionVideo,
  fadeOutAndKillMotionVideo,
  killMotionPlayer,
  initMotionSwipeVolume,
  updateMotionSwipeVolume,
  restoreMotionSwipeVolume,
  clearLightboxPhotoMask,
  updateLightboxPhotoMask,
  getLightboxLayout,
  updateLightboxLayout
};
export type { LbLayout };

// Backward-compatible stubs for legacy circular setter bridges (now no-ops)
export function setMobileScrollToSlideCallback(callback: ((i: number, immediate: boolean, dir: number) => void) | null) {
  setMobileScrollHandler(callback);
}
