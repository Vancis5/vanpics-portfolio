export class UIStore {
  isMobile: boolean = typeof window !== 'undefined' ? window.matchMedia('(hover: none)').matches : false;
  heroVisible: boolean = true;
  pageVisible: boolean = true;
  heroRafId: number | null = null;
  glowRafId: number | null = null;
  fsRaf: number | null = null;
  heroScrollY: number = 0;
  isManuallyNavigating: boolean = false;
  isUserTouching: boolean = false;
  isTouchingFilmstrip: boolean = false;
  filmstripHideTimer: any = null;
  lbZoomLevel: number = 1;
  lbZoomPanX: number = 0;
  lbZoomPanY: number = 0;
  lastInputType: 'pointer' | 'keyboard' = 'pointer';
  pushNextState: boolean = false;
  isPopState: boolean = false;
  lightboxHistoryPushed: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', () => {
        this.lastInputType = 'keyboard';
      }, { passive: true });
      
      window.addEventListener('mousedown', () => {
        this.lastInputType = 'pointer';
      }, { passive: true });
      
      window.addEventListener('touchstart', () => {
        this.lastInputType = 'pointer';
      }, { passive: true });
    }
  }

  setZoom(level: number, panX: number = 0, panY: number = 0) {
    this.lbZoomLevel = level;
    this.lbZoomPanX = panX;
    this.lbZoomPanY = panY;
  }

  resetZoom() {
    this.lbZoomLevel = 1;
    this.lbZoomPanX = 0;
    this.lbZoomPanY = 0;
  }
}

export const uiStore = new UIStore();
