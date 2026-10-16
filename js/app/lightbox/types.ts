import type { Photo, Video } from '../../types.js';

export type LightboxMediaItem = Photo | Video;

export interface LightboxContentOptions {
  skipHeightUpdate?: boolean;
}

export interface DescFlipOptions {
  startImgRect?: DOMRect | null;
  startInfoRect?: DOMRect | null;
  applyLayoutChange: () => void;
  afterInvert?: () => void;
  cleanup?: (() => void) | null;
}

export interface LightboxFacade {
  open: (index: number, direction?: number, isMotion?: boolean) => void;
  close: (shouldPushState?: boolean) => void;
  next: () => void;
  prev: () => void;
}
