import type { Photo } from '../../types.js';
import { photoLibrary, getPhotoLibrary } from '../media-data.js';

function getInitialCategory(): string {
  if (typeof window === 'undefined' || !window.location.hash) return 'all';
  const initialHash = window.location.hash.substring(1).split('/')[0];
  if (initialHash === 'figures') return 'figures';
  if (initialHash === 'motion') return 'motion';
  return 'all';
}

function getCarouselPhotos(): Photo[] {
  const heroPhotos = photoLibrary.filter(photo => photo.heroSlide === true && photo.title !== '');
  if (heroPhotos.length > 0) return heroPhotos;
  return photoLibrary.filter(photo => photo.title !== '');
}

export class GalleryStore {
  currentCategory: string = getInitialCategory();
  activePhotos: Photo[] = [];
  carouselPhotos: Photo[] = getCarouselPhotos();
  cur: number = 0;
  currentLightboxIsMotion: boolean = false;

  constructor() {
    this.updateActivePhotos();
    this.preloadCarouselThumbnails();
  }

  updateActivePhotos(): Photo[] {
    this.activePhotos = getPhotoLibrary(this.currentCategory);
    return this.activePhotos;
  }

  setCategory(category: string): Photo[] {
    this.currentCategory = category;
    return this.updateActivePhotos();
  }

  setCur(index: number) {
    this.cur = index;
  }

  setLightboxIsMotion(isMotion: boolean) {
    this.currentLightboxIsMotion = isMotion;
  }

  private preloadCarouselThumbnails() {
    if (typeof window === 'undefined') return;
    this.carouselPhotos.slice(0, 6).forEach(photo => {
      const img = new Image();
      img.src = photo.thumb || photo.src;
    });
  }
}

export const galleryStore = new GalleryStore();
