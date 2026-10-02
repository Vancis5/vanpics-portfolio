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
  initBlurRenderer,
  preloadLightboxBlurNeighbors,
  scheduleLightboxBlurNeighborPreload,
  toggleLightboxDesc,
  resetDescToggle,
  cancelDescFlipTransition,
  updateLightboxDescPreview,
  refreshLightboxInfoRefs
} from './renderer.js';

import {
  prepareLightboxPhoto,
  renderVideoInLightbox,
  startUnifiedMotionPlayer,
  clearLightboxPhotoPlaceholder
} from '../lightbox-media.js';

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
  initBlurRenderer,
  preloadLightboxBlurNeighbors,
  scheduleLightboxBlurNeighborPreload,
  toggleLightboxDesc,
  resetDescToggle,
  cancelDescFlipTransition,
  updateLightboxDescPreview,
  refreshLightboxInfoRefs,
  prepareLightboxPhoto,
  renderVideoInLightbox,
  startUnifiedMotionPlayer,
  clearLightboxPhotoPlaceholder
};

// Backward-compatible stubs for legacy circular setter bridges (now no-ops)
export function setMobileScrollToSlideCallback(callback: ((i: number, immediate: boolean, dir: number) => void) | null) {
  setMobileScrollHandler(callback);
}
