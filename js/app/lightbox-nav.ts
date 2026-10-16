import { domRefs } from './dom.js';
import { state } from './state.js';
import { navigateLightbox, getCurrentLightboxItems } from './lightbox.js';
import { debounce } from './utils.js';


let mouseX = -1000;
let mouseY = -1000;

let targetProximityLeft = 0;
let targetProximityRight = 0;
let currentProximityLeft = 0;
let currentProximityRight = 0;

let targetArrowOffsetY = 0;
let currentArrowOffsetY = 0;

// Restrained click press & release state
let clickProgressLeft = 0;
let clickStageLeft = 0; // 0: idle, 1: press, 2: release

let clickProgressRight = 0;
let clickStageRight = 0;

let lastNavTime = 0;
let isNavActive = false;

// Hold-to-repeat acceleration state
let holdRepeatTimer: any = null;
let holdActiveSide: 'left' | 'right' | null = null;
let holdStepCount = 0;

function stopHoldRepeat() {
  if (holdRepeatTimer) {
    clearTimeout(holdRepeatTimer);
    holdRepeatTimer = null;
  }
  holdActiveSide = null;
  holdStepCount = 0;
}

function scheduleHoldRepeatStep(side: 'left' | 'right') {
  if (holdActiveSide !== side) return;

  // Instant fast rate matching keyboard repeat (~60ms)
  const interval = 60;

  holdRepeatTimer = setTimeout(() => {
    if (holdActiveSide !== side) return;
    const lb = domRefs.lightbox;
    if (!lb || state.isMobile || !lb.classList.contains('open')) {
      stopHoldRepeat();
      return;
    }
    if (typeof state.lbZoomLevel !== 'undefined' && state.lbZoomLevel > 1) {
      stopHoldRepeat();
      return;
    }

    const prox = side === 'left' ? currentProximityLeft : currentProximityRight;
    if (prox <= 0.08) {
      stopHoldRepeat();
      return;
    }

    holdStepCount++;
    lastNavTime = Date.now();
    triggerArrowPulse(side);
    navigateLightbox(side === 'left' ? -1 : 1);

    scheduleHoldRepeatStep(side);
  }, interval);
}

function startHoldRepeat(side: 'left' | 'right') {
  stopHoldRepeat();
  holdActiveSide = side;
  holdStepCount = 1;

  // Initial delay matching keyboard repeat delay (200ms)
  holdRepeatTimer = setTimeout(() => {
    scheduleHoldRepeatStep(side);
  }, 200);
}

let navIdleTimeout: any = null;

function resetNavIdleTimeout() {
  clearTimeout(navIdleTimeout);
  if (holdActiveSide) return;
  // Match custom pointer standby duration (2000ms)
  navIdleTimeout = setTimeout(() => {
    targetProximityLeft = 0;
    targetProximityRight = 0;
    stopHoldRepeat();
    startNavAnimationLoop();
  }, 2000);
}

export function initLightboxMouseNav() {
  const lb = domRefs.lightbox;
  if (!lb) return;

  function handleViewportLeave() {
    mouseX = -1000;
    mouseY = -1000;
    targetProximityLeft = 0;
    targetProximityRight = 0;
    clearTimeout(navIdleTimeout);
    stopHoldRepeat();
    startNavAnimationLoop();
  }

  // Track mouse movement inside window when lightbox is open
  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (state.isMobile || !lb.classList.contains('open')) {
      targetProximityLeft = 0;
      targetProximityRight = 0;
      clearTimeout(navIdleTimeout);
      stopHoldRepeat();
      return;
    }

    if (e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY <= 0 || e.clientY >= window.innerHeight) {
      handleViewportLeave();
      return;
    }

    const items = getCurrentLightboxItems();
    if (!items || items.length <= 1) {
      targetProximityLeft = 0;
      targetProximityRight = 0;
      clearTimeout(navIdleTimeout);
      stopHoldRepeat();
      return;
    }

    if (typeof state.lbZoomLevel !== 'undefined' && state.lbZoomLevel > 1) {
      targetProximityLeft = 0;
      targetProximityRight = 0;
      clearTimeout(navIdleTimeout);
      stopHoldRepeat();
      return;
    }

    mouseX = e.clientX;
    mouseY = e.clientY;

    // Cap vertical travel near middle zone with soft tanh ease-out deceleration
    const height = window.innerHeight;
    const midY = height / 2;
    const dy = e.clientY - midY;
    const maxTravel = height * 0.20;
    const cushion = height * 0.07;

    if (Math.abs(dy) <= maxTravel) {
      targetArrowOffsetY = dy;
    } else {
      const sign = Math.sign(dy);
      const overflow = Math.abs(dy) - maxTravel;
      const dampedOverflow = cushion * Math.tanh(overflow / cushion);
      targetArrowOffsetY = sign * (maxTravel + dampedOverflow);
    }

    const target = e.target as HTMLElement | null;
    const isArrow = target ? target.closest('.lightbox-nav-arrow') : null;
    const interactive = target ? target.closest(
      '#lightbox-img, .zoomable, #lightbox-close, #filmstrip-wrap, #filmstrip-lift-zone, .media-controls, button, a, input, video, media-player, media-controls'
    ) : null;

    if (interactive && !isArrow) {
      targetProximityLeft = 0;
      targetProximityRight = 0;
      clearTimeout(navIdleTimeout);
      stopHoldRepeat();
      return;
    }

    const width = window.innerWidth;
    const leftThreshold = width * 0.38;
    const rightThreshold = width * 0.62;

    if (mouseX < leftThreshold) {
      const rawP = (leftThreshold - mouseX) / leftThreshold;
      targetProximityLeft = Math.pow(Math.max(0, Math.min(1, rawP)), 0.85);
      targetProximityRight = 0;
    } else if (mouseX > rightThreshold) {
      const rawP = (mouseX - rightThreshold) / (width - rightThreshold);
      targetProximityRight = Math.pow(Math.max(0, Math.min(1, rawP)), 0.85);
      targetProximityLeft = 0;
    } else {
      targetProximityLeft = 0;
      targetProximityRight = 0;
      stopHoldRepeat();
    }

    resetNavIdleTimeout();
    startNavAnimationLoop();
  });

  window.addEventListener('mouseup', () => {
    stopHoldRepeat();
    resetNavIdleTimeout();
  });

  document.addEventListener('mouseleave', handleViewportLeave);
  document.documentElement.addEventListener('mouseleave', handleViewportLeave);
  document.addEventListener('mouseout', (e: MouseEvent) => {
    if (!e.relatedTarget && !(e as any).toElement) {
      handleViewportLeave();
    }
  });
  window.addEventListener('blur', handleViewportLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handleViewportLeave();
  });

  // Instant 0ms navigation & press feedback on mousedown + hold-to-repeat
  lb.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (state.isMobile || !lb.classList.contains('open')) return;
    const items = getCurrentLightboxItems();
    if (!items || items.length <= 1) return;
    if (typeof state.lbZoomLevel !== 'undefined' && state.lbZoomLevel > 1) return;

    const infoWrap = domRefs.lightboxInfoWrap;
    const infoRect = infoWrap ? infoWrap.getBoundingClientRect() : null;
    const isOverInfoColumn = !!(infoRect && infoRect.width > 0 && e.clientX >= infoRect.left && e.clientX <= infoRect.right);

    const target = e.target as HTMLElement | null;
    const isArrow = target ? target.closest('.lightbox-nav-arrow') : null;
    const interactive = target ? target.closest(
      '#lightbox-img, .zoomable, #lightbox-close, #lightbox-info-wrap, #filmstrip-wrap, #filmstrip-lift-zone, .media-controls, button, a, input, video, media-player, media-controls'
    ) : null;
    if ((interactive || isOverInfoColumn) && !isArrow) return;

    if (currentProximityLeft > 0.08) {
      e.preventDefault();
      e.stopPropagation();
      lastNavTime = Date.now();
      triggerArrowPulse('left');
      navigateLightbox(-1);
      startHoldRepeat('left');
    } else if (currentProximityRight > 0.08) {
      e.preventDefault();
      e.stopPropagation();
      lastNavTime = Date.now();
      triggerArrowPulse('right');
      navigateLightbox(1);
      startHoldRepeat('right');
    }
  });

  // Prevent duplicate trigger on click
  lb.addEventListener('click', (e: MouseEvent) => {
    if (state.isMobile || !lb.classList.contains('open')) return;
    if (Date.now() - lastNavTime < 350) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  [
    { el: domRefs.lightboxArrowLeft, dir: -1, side: 'left' as const },
    { el: domRefs.lightboxArrowRight, dir: 1, side: 'right' as const }
  ].forEach(({ el, dir, side }) => {
    if (!el) return;
    el.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        lastNavTime = Date.now();
        triggerArrowPulse(side);
        navigateLightbox(dir);
      }
    });
  });

  startNavAnimationLoop();
}

function triggerArrowPulse(side: 'left' | 'right') {
  if (side === 'left') {
    clickStageLeft = 1;
    clickProgressLeft = 1.0;
  } else {
    clickStageRight = 1;
    clickProgressRight = 1.0;
  }
}

let navRafId: number | null = null;
let cachedLeftRect: DOMRect | null = null;
let cachedRightRect: DOMRect | null = null;

function invalidateArrowRects() {
  cachedLeftRect = null;
  cachedRightRect = null;
}



window.addEventListener('resize', debounce(invalidateArrowRects, 150), { passive: true });


export function startNavAnimationLoop() {
  if (isNavActive) return;
  isNavActive = true;
  invalidateArrowRects();

  const BASE_HZ = 60;
  let lastTime = performance.now();

  function update(now: number) {
    const lb = domRefs.lightbox;
    if (!isNavActive || !lb || !lb.classList.contains('open')) {
      isNavActive = false;
      navRafId = null;
      return;
    }

    const dt = Math.min((now - lastTime) / (1000 / BASE_HZ), 3); // clamp to avoid jumps after tab switch
    lastTime = now;

    // Check idle state — if everything settled and target is 0, stop loop
    const isIdle = targetProximityLeft === 0 && targetProximityRight === 0 &&
      currentProximityLeft < 0.005 && currentProximityRight < 0.005 &&
      Math.abs(currentArrowOffsetY - targetArrowOffsetY) < 0.5 &&
      clickStageLeft === 0 && clickStageRight === 0;

    if (isIdle) {
      currentProximityLeft = 0;
      currentProximityRight = 0;
      isNavActive = false;
      navRafId = null;
      const arrowLeft = domRefs.lightboxArrowLeft;
      const arrowRight = domRefs.lightboxArrowRight;
      const glowLeft = domRefs.lightboxGlowLeft;
      const glowRight = domRefs.lightboxGlowRight;
      if (arrowLeft) { arrowLeft.style.opacity = '0'; arrowLeft.style.filter = 'blur(12px)'; }
      if (arrowRight) { arrowRight.style.opacity = '0'; arrowRight.style.filter = 'blur(12px)'; }
      if (glowLeft) glowLeft.style.opacity = '0';
      if (glowRight) glowRight.style.opacity = '0';
      return;
    }

    const arrowLeft = domRefs.lightboxArrowLeft;
    const arrowRight = domRefs.lightboxArrowRight;

    if (arrowLeft) {
      if (!cachedLeftRect) cachedLeftRect = arrowLeft.getBoundingClientRect();
      const r = cachedLeftRect;
      if (mouseX >= r.left && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom) {
        targetProximityLeft = 1;
      }
    }
    if (arrowRight) {
      if (!cachedRightRect) cachedRightRect = arrowRight.getBoundingClientRect();
      const r = cachedRightRect;
      if (mouseX >= r.left && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom) {
        targetProximityRight = 1;
      }
    }

    // Correct delta-time lerp factor scaling (0.18 tracking, 0.32 fade-out, 0.075 Y calibrated at 60Hz)
    const isExiting = targetProximityLeft === 0 && targetProximityRight === 0;
    const proxLerp = isExiting ? 0.32 : 0.18;
    const alphaProx = 1 - Math.pow(1 - proxLerp, dt);
    const alphaY = 1 - Math.pow(1 - 0.075, dt);
    const alphaClick = 1 - Math.pow(1 - 0.18, dt);

    currentProximityLeft += (targetProximityLeft - currentProximityLeft) * alphaProx;
    currentProximityRight += (targetProximityRight - currentProximityRight) * alphaProx;
    currentArrowOffsetY += (targetArrowOffsetY - currentArrowOffsetY) * alphaY;

    // Instant press -> snappy release click interpolation (Left)
    if (clickStageLeft === 1) {
      clickProgressLeft = 1.0;
      clickStageLeft = 2;
    } else if (clickStageLeft === 2) {
      clickProgressLeft += (0 - clickProgressLeft) * alphaClick;
      if (clickProgressLeft < 0.005) {
        clickProgressLeft = 0;
        clickStageLeft = 0;
      }
    }

    // Instant press -> snappy release click interpolation (Right)
    if (clickStageRight === 1) {
      clickProgressRight = 1.0;
      clickStageRight = 2;
    } else if (clickStageRight === 2) {
      clickProgressRight += (0 - clickProgressRight) * alphaClick;
      if (clickProgressRight < 0.005) {
        clickProgressRight = 0;
        clickStageRight = 0;
      }
    }

    const glowLeft = domRefs.lightboxGlowLeft;
    const glowRight = domRefs.lightboxGlowRight;

    const pLeft = currentProximityLeft < 0.005 ? 0 : currentProximityLeft;
    const pRight = currentProximityRight < 0.005 ? 0 : currentProximityRight;

    // ── Left Side Effects ──
    if (glowLeft) {
      const glowOpacity = Math.min(1, pLeft + clickProgressLeft * 0.15);
      glowLeft.style.opacity = glowOpacity.toFixed(3);
      glowLeft.style.setProperty('--glow-y', `calc(50% + ${currentArrowOffsetY.toFixed(1)}px)`);
    }

    if (arrowLeft) {
      if (pLeft > 0 || clickProgressLeft > 0.01) {
        const baseScale = 0.45 + pLeft * 0.75;
        const clickScaleMod = 1 - clickProgressLeft * 0.08;
        const scale = (baseScale * clickScaleMod).toFixed(3);

        const opacity = Math.min(1, Math.max(pLeft * 1.25, clickProgressLeft)).toFixed(3);
        const blur = ((1 - Math.min(1, pLeft)) * (12 * (1 - clickProgressLeft))).toFixed(1);

        const clickRecoilX = -4 * clickProgressLeft;
        const hoverX = -14 * (1 - pLeft);
        const translateX = (hoverX + clickRecoilX).toFixed(1);

        arrowLeft.style.opacity = opacity;
        arrowLeft.style.transform = `translate3d(0, calc(-50% + ${currentArrowOffsetY.toFixed(1)}px), 0) scale(${scale}) translateX(${translateX}px)`;
        arrowLeft.style.filter = `blur(${blur}px)`;

        const svg = arrowLeft.querySelector('svg');
        if (svg) {
          const svgNudge = -3 * clickProgressLeft;
          (svg as SVGElement).style.transform = `translateX(${svgNudge.toFixed(1)}px)`;
        }
      } else {
        arrowLeft.style.opacity = '0';
        arrowLeft.style.filter = 'blur(12px)';
      }
    }

    // ── Right Side Effects ──
    if (glowRight) {
      const glowOpacity = Math.min(1, pRight + clickProgressRight * 0.15);
      glowRight.style.opacity = glowOpacity.toFixed(3);
      glowRight.style.setProperty('--glow-y', `calc(50% + ${currentArrowOffsetY.toFixed(1)}px)`);
    }

    if (arrowRight) {
      if (pRight > 0 || clickProgressRight > 0.01) {
        const baseScale = 0.45 + pRight * 0.75;
        const clickScaleMod = 1 - clickProgressRight * 0.08;
        const scale = (baseScale * clickScaleMod).toFixed(3);

        const opacity = Math.min(1, Math.max(pRight * 1.25, clickProgressRight)).toFixed(3);
        const blur = ((1 - Math.min(1, pRight)) * (12 * (1 - clickProgressRight))).toFixed(1);

        const clickRecoilX = 4 * clickProgressRight;
        const hoverX = 14 * (1 - pRight);
        const translateX = (hoverX + clickRecoilX).toFixed(1);

        arrowRight.style.opacity = opacity;
        arrowRight.style.transform = `translate3d(0, calc(-50% + ${currentArrowOffsetY.toFixed(1)}px), 0) scale(${scale}) translateX(${translateX}px)`;
        arrowRight.style.filter = `blur(${blur}px)`;

        const svg = arrowRight.querySelector('svg');
        if (svg) {
          const svgNudge = 3 * clickProgressRight;
          (svg as SVGElement).style.transform = `translateX(${svgNudge.toFixed(1)}px)`;
        }
      } else {
        arrowRight.style.opacity = '0';
        arrowRight.style.filter = 'blur(12px)';
      }
    }

    navRafId = requestAnimationFrame(update);
  }

  navRafId = requestAnimationFrame(update);
}

export function resetLightboxMouseNav() {
  mouseX = -1000;
  mouseY = -1000;
  targetProximityLeft = 0;
  targetProximityRight = 0;
  currentProximityLeft = 0;
  currentProximityRight = 0;
  clickProgressLeft = 0;
  clickStageLeft = 0;
  clickProgressRight = 0;
  clickStageRight = 0;
  isNavActive = false;
  if (navRafId) {
    cancelAnimationFrame(navRafId);
    navRafId = null;
  }
  clearTimeout(navIdleTimeout);
  stopHoldRepeat();
}

export function getLastSideNavTime(): number {
  return lastNavTime;
}

export function hideLightboxNavImmediately() {
  mouseX = -1000;
  mouseY = -1000;
  targetProximityLeft = 0;
  targetProximityRight = 0;
  currentProximityLeft = 0;
  currentProximityRight = 0;
  clickProgressLeft = 0;
  clickStageLeft = 0;
  clickProgressRight = 0;
  clickStageRight = 0;
  stopHoldRepeat();
  clearTimeout(navIdleTimeout);

  const arrowLeft = domRefs.lightboxArrowLeft;
  const arrowRight = domRefs.lightboxArrowRight;
  const glowLeft = domRefs.lightboxGlowLeft;
  const glowRight = domRefs.lightboxGlowRight;

  if (arrowLeft) {
    arrowLeft.style.opacity = '0';
    arrowLeft.style.filter = 'blur(12px)';
  }
  if (arrowRight) {
    arrowRight.style.opacity = '0';
    arrowRight.style.filter = 'blur(12px)';
  }
  if (glowLeft) glowLeft.style.opacity = '0';
  if (glowRight) glowRight.style.opacity = '0';
}
