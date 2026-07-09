export interface Photo {
  id?: string | number;
  src: string;
  thumb?: string;
  raw_src?: string;
  rawSrc?: string;
  title: string;
  desc?: string;
  date?: string;
  location?: string;
  aspect_ratio?: number;
  aspectRatio?: number;
  hero_slide?: number | boolean | string;
  heroSlide?: boolean;
  category?: string;
  created_at?: string;
  type?: 'photo';
}

export interface Video {
  id?: string | number;
  src: string;
  poster?: string;
  thumb?: string;
  title: string;
  desc?: string;
  date?: string;
  location?: string;
  aspect_ratio?: number;
  aspectRatio?: number;
  music?: string;
  created_at?: string;
  type?: 'video';
}

export type MediaItem = (Photo & { type: 'photo' }) | (Video & { type: 'video' });

declare global {
  interface Window {
    lenis?: any;
    fsLenis?: any;
    _scrollbarDragging?: boolean;
    deletePhoto?: (id: string | number, title?: string) => Promise<void>;
    dropZone?: HTMLElement;
    fileInput?: HTMLInputElement;
    previewContainer?: HTMLElement;
    imgPreview?: HTMLImageElement;
    removeBtn?: HTMLElement;
    isAutoRapidScrolling?: boolean;
  }
}
