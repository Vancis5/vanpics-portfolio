var domRefs = window.domRefs;


// ── MOTION: swap this to change which video plays ──

function showFilmstripIfReady() {
  if (typeof window.showFilmstrip === 'function') window.showFilmstrip();
}

function hideFilmstripIfReady() {
  if (typeof window.hideFilmstrip === 'function') window.hideFilmstrip();
}

function clearFilmstripHideTimerIfReady() {
  if (typeof filmstripHideTimer !== 'undefined' && filmstripHideTimer) {
    window.clearTimeout(filmstripHideTimer);
  }
}

function setFilmstripLiftZoneDisplay(display) {
  const liftZone = domRefs.filmstripLiftZone;
  if (liftZone) liftZone.style.display = display;
}

function startLoopsIfReady() {
  if (typeof window.startLoops === 'function') window.startLoops();
}

// GLOW BALL
const glowBall = domRefs.glowBall;
let glowX = window.innerWidth / 2, glowY = window.innerHeight / 2;
let glowTargetX = glowX, glowTargetY = glowY;
let mouseInHero = false;

// Declared at outer scope so bootstrap.js can always find it via typeof check,
// even under strict mode or future ES module migration.
var animateGlow = null;

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
    const targetOp = (mouseInHero && heroVisible && pageVisible) ? scrollFade : 0;

    if (glowBall.style.opacity != targetOp) {
      glowBall.style.opacity = targetOp;
    }

    // Stop loop only if target is 0 AND transition is essentially done
    if (targetOp === 0 && (!glowBall.style.opacity || parseFloat(glowBall.style.opacity) < 0.01)) {
      glowRafId = null;
      return;
    }

    glowX += (glowTargetX - glowX) * 0.08;
    glowY += (glowTargetY - glowY) * 0.08;
    glowBall.style.left = glowX + 'px';
    glowBall.style.top = glowY + 'px';
    glowRafId = requestAnimationFrame(animateGlow);
  };
}

window.showFilmstripIfReady = showFilmstripIfReady;
window.hideFilmstripIfReady = hideFilmstripIfReady;
window.clearFilmstripHideTimerIfReady = clearFilmstripHideTimerIfReady;
window.setFilmstripLiftZoneDisplay = setFilmstripLiftZoneDisplay;
window.startLoopsIfReady = startLoopsIfReady;
window.animateGlow = animateGlow;
