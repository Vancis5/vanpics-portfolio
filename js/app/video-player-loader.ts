// video.js (minimal UI) is only needed once someone opens a motion piece, so it is no longer
// a <script> in index.html. It loads on first interaction / idle, or immediately when a motion
// lightbox renders. Same CDN + SRI as before, with the local /vendor copy as fallback.
const CDN_SRC = 'https://cdn.jsdelivr.net/npm/@videojs/html/cdn/video-minimal-ui.js';
const CDN_SRI = 'sha384-xvwA3Pz3/jXep9mMlx56tEboXqea6AuWRXb8i6/j1Pxw8EBdyZtfLxg4wZAkE2Lp';
const LOCAL_FALLBACK = '/vendor/video-minimal-ui.js';

let pending: Promise<void> | null = null;

export function loadVideoPlayer(): Promise<void> {
  if (pending) return pending;
  pending = new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = CDN_SRC;
    s.integrity = CDN_SRI;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => {
      import(/* @vite-ignore */ LOCAL_FALLBACK).then(() => resolve(), () => resolve());
    };
    document.head.appendChild(s);
  });
  return pending;
}

export function warmVideoPlayer(): void {
  const idle = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => { void loadVideoPlayer(); }, { timeout: 3000 });
    else setTimeout(() => { void loadVideoPlayer(); }, 0);
  };
  const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
  const onFirstInput = () => {
    events.forEach((t) => window.removeEventListener(t, onFirstInput, true));
    idle();
  };
  events.forEach((t) => window.addEventListener(t, onFirstInput, { capture: true, passive: true }));

  if (document.readyState === 'complete') setTimeout(idle, 6000);
  else window.addEventListener('load', () => setTimeout(idle, 6000), { once: true });
}
