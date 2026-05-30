import { domRefs } from './dom.js';
import { state } from './state.js';

let filmstripVisibilityHandlers = {};
let startLoopsCallback = null;

export function setFilmstripVisibilityHandlers(handlers) {
  filmstripVisibilityHandlers = handlers || {};
}

export function setStartLoopsCallback(callback) {
  startLoopsCallback = callback;
}


// ── MOTION: swap this to change which video plays ──

export function showFilmstripIfReady() {
  if (typeof filmstripVisibilityHandlers.show === 'function') filmstripVisibilityHandlers.show();
}

export function hideFilmstripIfReady() {
  if (typeof filmstripVisibilityHandlers.hide === 'function') filmstripVisibilityHandlers.hide();
}

export function clearFilmstripHideTimerIfReady() {
  if (typeof state.filmstripHideTimer !== 'undefined' && state.filmstripHideTimer) {
    window.clearTimeout(state.filmstripHideTimer);
  }
}

export function setFilmstripLiftZoneDisplay(display) {
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
export let animateGlow = null;

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
    const scrollFade = Math.max(0, 1 - (window.scrollY / 350));
    const targetOp = (mouseInHero && state.heroVisible && state.pageVisible) ? scrollFade : 0;

    if (glowBall.style.opacity != targetOp) {
      glowBall.style.opacity = targetOp;
    }

    // Stop loop only if target is 0 AND transition is essentially done
    if (targetOp === 0 && (!glowBall.style.opacity || parseFloat(glowBall.style.opacity) < 0.01)) {
      state.glowRafId = null;
      return;
    }

    glowX += (glowTargetX - glowX) * 0.08;
    glowY += (glowTargetY - glowY) * 0.08;
    glowBall.style.left = glowX + 'px';
    glowBall.style.top = glowY + 'px';
    state.glowRafId = requestAnimationFrame(animateGlow);
  };
}
