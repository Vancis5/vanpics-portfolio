import { domRefs } from './dom.js';
import { state } from './state.js';

let filmstripVisibilityHandlers: any = {};
let startLoopsCallback: (() => void) | null = null;

export function setFilmstripVisibilityHandlers(handlers: any) {
  filmstripVisibilityHandlers = handlers || {};
}

export function setStartLoopsCallback(callback: (() => void) | null) {
  startLoopsCallback = callback;
}


// ── MOTION: swap this to change which video plays ──

export function showFilmstripIfReady() {
  if (typeof filmstripVisibilityHandlers.show === 'function') filmstripVisibilityHandlers.show();
}

export function hideFilmstripIfReady(force?: boolean) {
  if (typeof filmstripVisibilityHandlers.hide === 'function') filmstripVisibilityHandlers.hide(force);
}

export function clearFilmstripHideTimerIfReady() {
  if (typeof state.filmstripHideTimer !== 'undefined' && state.filmstripHideTimer) {
    window.clearTimeout(state.filmstripHideTimer);
  }
}

export function setFilmstripLiftZoneDisplay(display: string) {
  const liftZone = domRefs.filmstripLiftZone;
  if (liftZone) liftZone.style.display = display;
}

export function startLoopsIfReady() {
  if (typeof startLoopsCallback === 'function') startLoopsCallback();
}

// GLOW BALL
const glowBall = domRefs.glowBall;
let glowX = window.innerWidth / 2, glowY = window.innerHeight / 2;
let glowTargetX = glowX, glowTargetY = glowY;
let mouseInHero = false;

// Declared at outer scope so bootstrap.js can always find it via typeof check,
// even under strict mode or future ES module migration.
export let animateGlow: (() => void) | null = null;

if (glowBall && domRefs.hero) {
  const hero = domRefs.hero;
  hero.addEventListener('mouseenter', function () { mouseInHero = true; startLoopsIfReady(); });
  hero.addEventListener('mouseleave', function () { mouseInHero = false; });
  hero.addEventListener('mousemove', function (e) {
    const rect = hero.getBoundingClientRect();
    glowTargetX = e.clientX - rect.left;
    glowTargetY = e.clientY - rect.top;
  });
  animateGlow = function () {
    try {
      const scrollFade = Math.max(0, 1 - (window.scrollY / 350));
      const targetOp = (mouseInHero && state.heroVisible && state.pageVisible) ? scrollFade : 0;

      if (glowBall.style.opacity !== String(targetOp)) {
        glowBall.style.opacity = String(targetOp);
      }

      // Stop loop only if target is 0 AND transition is essentially done
      if (targetOp === 0 && (!glowBall.style.opacity || parseFloat(glowBall.style.opacity) < 0.01)) {
        state.glowRafId = null;
        return;
      }

      glowX += (glowTargetX - glowX) * 0.08;
      glowY += (glowTargetY - glowY) * 0.08;
      glowBall.style.transform = `translate(-50%, -50%) translate3d(${glowX}px, ${glowY}px, 0)`;
    } catch (error) {
      console.error('Error in glow animation loop:', error);
      state.glowRafId = null;
      return;
    }
    state.glowRafId = requestAnimationFrame(animateGlow as FrameRequestCallback);
  };
}

// FOOTER GLOW BALL
const footerGlow = domRefs.footerGlowBall;
const siteFooter = domRefs.siteFooter;
let footerGlowX = 0, footerGlowY = 0;
let footerGlowTargetX = 0, footerGlowTargetY = 0;
let mouseInFooter = false;
let footerGlowRafId: number | null = null;

function animateFooterGlow() {
  if (!mouseInFooter) {
    footerGlowRafId = null;
    return;
  }
  footerGlowX += (footerGlowTargetX - footerGlowX) * 0.08;
  footerGlowY += (footerGlowTargetY - footerGlowY) * 0.08;
  if (footerGlow) {
    footerGlow.style.left = footerGlowX + 'px';
    footerGlow.style.top = footerGlowY + 'px';
  }
  footerGlowRafId = requestAnimationFrame(animateFooterGlow);
}

if (footerGlow && siteFooter) {
  siteFooter.addEventListener('mouseenter', function () {
    mouseInFooter = true;
    if (!footerGlowRafId) {
      footerGlowRafId = requestAnimationFrame(animateFooterGlow);
    }
  });
  siteFooter.addEventListener('mouseleave', function () {
    mouseInFooter = false;
  });
  siteFooter.addEventListener('mousemove', function (e) {
    const rect = siteFooter.getBoundingClientRect();
    footerGlowTargetX = e.clientX - rect.left;
    footerGlowTargetY = e.clientY - rect.top;
  });
}
