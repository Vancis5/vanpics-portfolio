# 🔍 Codebase Audit — vanpics-portfolio

**Date:** May 29, 2026  
**Scope:** All JS modules, HTML, CSS, data files, and build config

---

## 🔴 P0 — Critical (will crash or break core functionality)

### 1. Video fallback file is a broken import

**File:** [video-minimal-ui.js](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/vendor/video-minimal-ui.js)

The local fallback for the CDN video player is:
```js
import"./minimal-ui-B0PWg1gR.js";import"./minimal-D-o7FGL2.js";
```

These two imported files (`minimal-ui-B0PWg1gR.js`, `minimal-D-o7FGL2.js`) **don't exist** in the vendor folder. So if the CDN ever goes down (or the SRI hash fails on a new browser), the `onerror` handler on line 48-50 of `index.html` fires a dynamic `import('/vendor/video-minimal-ui.js')` that will **silently fail** — no video player at all, no error shown to the user.

> [!CAUTION]
> This is a ticking time bomb. If jsdelivr goes down for even a minute, anyone visiting sees a completely broken motion section.

---

### 2. `user-scalable=no` blocks accessibility zoom

**File:** [index.html:7](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/index.html#L7)

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

This violates WCAG 1.4.4 (Resize Text). Users with low vision literally **cannot zoom** your site. Modern iOS Safari ignores this anyway, but Android Chrome still respects it. It also triggers Lighthouse accessibility failures.

**Fix:** Remove `maximum-scale=1.0` and `user-scalable=no`. The pinch-zoom logic in `lightbox-zoom.js` already handles zooming in the lightbox contextually — you don't need the nuclear viewport lock.

---

## 🟠 P1 — High (functional bugs or significant UX issues)

### 3. `animateGlow` is unreachable when strict mode is enabled

**File:** [core.js:237-267](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/core.js#L237-L267)

`animateGlow()` is defined **inside** the `if (glowBall && domRefs.hero)` block, making it local scope. But [bootstrap.js:83](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/bootstrap.js#L83) checks `typeof animateGlow === 'function'` before calling it. Because it's a function *declaration* inside a block, behavior differs per engine:
- **Strict mode:** `animateGlow` is block-scoped — `startLoops()` will never find it
- **Sloppy mode (current):** browsers hoist it to function scope (non-standard but works)

This is fragile. If you ever add `"use strict"` or switch to ES modules, glow breaks silently.

---

### 4. XSS vector in gallery card overlay

**File:** [gallery.js:249](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/gallery.js#L249)

```js
overlay.innerHTML = '<div class="photo-card-title">' + (p.title || "") + '</div>...'
```

Photo titles and dates are injected raw into `innerHTML`. You already have `escapeHtml()` in `core.js` — you're just not using it here. Same issue at [lightbox.js:154](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/lightbox.js#L154) where `descEl.innerHTML = safeDesc` injects the desc field (which *intentionally* has HTML like `<br>` and `<a>` tags).

The title injection is the real risk — if you ever accept user-generated titles or paste from an untrusted source, it's game over.

---

### 5. Keyboard nav fires during text input / regardless of lightbox state

**File:** [lightbox.js:716-722](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/lightbox.js#L716-L722)

```js
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') navigateLightbox(1);
  if (e.key === 'ArrowLeft') navigateLightbox(-1);
});
```

Two problems:
- Arrow keys fire even when lightbox is **closed** — `navigateLightbox()` runs against stale data
- If the browser ever renders an input (e.g., a search bar you add later), arrow keys would hijack text cursor navigation

**Fix:** Guard with `if (!domRefs.lightbox.classList.contains('open')) return;`

---

### 6. `cursor-ring` animation loop never stops

**File:** [cursor.js:41](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/cursor.js#L41)

```js
(function animateRing() { ... requestAnimationFrame(animateRing); })();
```

This rAF runs **forever** — even when the cursor is hidden, off-screen, or the tab is backgrounded (rAF pauses, but resumes immediately). There's no visibility check, no `cancelAnimationFrame` path. On a long session, this is wasted CPU.

---

## 🟡 P2 — Medium (performance, maintainability, correctness)

### 7. `scrollY` variable shadows `window.scrollY`

**File:** [hero-carousel.js:2](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/hero-carousel.js#L2)

```js
let scrollY = 0;
```

This creates a global `scrollY` that shadows the browser's built-in `window.scrollY`. It's written to in [smooth-scroll.js:62](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/smooth-scroll.js#L62) via `scrollY = scrollPos`. If smooth-scroll doesn't load (e.g., `prefers-reduced-motion: reduce`), `scrollY` stays at 0 forever — the hero parallax in `tick()` line 134 will use stale data.

**Fix:** Rename to `heroScrollY` or something that doesn't shadow a browser global.

---

### 8. Excessive `will-change` declarations (21 instances!)

**Files:** `style.css`, `player.css`, `media-minimal-skin.css`, `runtime-effects.css`

You have **21** `will-change` declarations across your CSS files. `will-change` should be applied sparingly and temporarily — having it permanent on 21 elements forces the browser to maintain separate composite layers for all of them, which *increases* memory usage and can actually make rendering **slower** on low-end devices.

> [!TIP]
> Best practice: only apply `will-change` just before an animation starts, and remove it after. Alternatively, limit it to the 3-4 elements that truly benefit (carousel rows, lightbox content, cursor).

---

### 9. Masonry column count ignores small screens

**File:** [gallery.js:188](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/gallery.js#L188)

```js
let numCols = (window.innerWidth >= 1024) ? 4 : 3;
```

On a phone (320-430px), 3 columns makes images absurdly tiny. There's no 2-column or 1-column breakpoint. The CSS likely handles some of this, but the JS is still distributing cards into 3 columns at 375px wide — each image is like ~115px which is borderline.

---

### 10. `isMobile` is set once and never updated

**File:** [core.js:212](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/core.js#L212)

```js
const isMobile = window.matchMedia('(hover: none)').matches;
```

This is a `const` evaluated at page load. If someone connects a mouse to their iPad, or rotates from portrait to landscape, `isMobile` is stale. Code throughout the entire app branches on this — lightbox swipe, cursor, filmstrip, scrollbar, zoom — all using the initial value.

Not the end of the world for a portfolio site, but worth knowing.

---

### 11. Duplicate `touchend` listeners on lightbox element

**File:** [lightbox-swipe.js:474 and 544](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/lightbox-swipe.js#L474-L555)

Two separate `lbEl.addEventListener('touchend', ...)` are registered:
- **Line 474:** Handles swipe-down-to-dismiss snap-back
- **Line 544:** Handles motion section horizontal swipe navigation

Both fire on every `touchend`. The second one has an early-return guard for motion mode, but both still run their initial checks every touch, adding unnecessary overhead. These should be a single handler with internal branching.

---

### 12. `var` declarations in data files pollute global scope

**Files:** [photos.js](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/data/photos.js), [videos.js](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/data/videos.js)

```js
var photos = [...];
var videos = [...];
```

Using `var` makes these hoisted window globals. `core.js` already guards with `typeof photos !== 'undefined'` which is fine — but if you ever load another script that also declares `var photos`, it silently overwrites yours. `const` would at least throw a redeclaration error.

---

## 🟢 P3 — Low (code quality, DX, minor polish)

### 13. No error boundary or user feedback on failed image loads

**File:** [lightbox.js:74-78](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/js/app/lightbox.js#L74-L78)

```js
img.onerror = function () {
  if (token !== photoPlaceholderToken) return;
  img.onload = null;
  img.onerror = null;
};
```

When a full-res photo fails to load, the placeholder spinner just... hangs. No fallback image, no "failed to load" message, nothing. The user stares at a shimmer animation forever. Consider at least showing the thumbnail or a broken-image state.

---

### 14. `player.css` and `media-minimal-skin.css` are near-duplicates

**Files:** `player.css` (25KB), `css/media-minimal-skin.css` (17KB)

Both contain media player skin styles. `player.css` is loaded globally in `<head>`, and `media-minimal-skin.css` is loaded right after. There's likely significant overlap. This is ~42KB of CSS for a video player skin — that's a lot of bytes for one video entry.

---

### 15. Missing `rel="noopener"` on external links in photo descriptions

**File:** [photos.js:12](file:///c:/Users/Administrator/Documents/Code/HTML-CSS/vanpics-portfolio/public/data/photos.js#L12)

```js
desc: "... taken by <a href='https://www.facebook.com/share/p/1aePoJX4dk/' target='_blank'>JohnB</a>"
```

This external link in the description is missing `rel="noopener noreferrer"`. When injected via `innerHTML`, it opens with `window.opener` access to your page. Minor security concern but easy fix.

---

## ⚪ Nitpicks

### 16. CRLF line endings in data files, LF everywhere else

`photos.js` and `videos.js` use `\r\n` (Windows CRLF). All other JS files use `\n` (Unix LF). This can cause git diff noise and merge conflicts. Add a `.gitattributes` with `*.js text eol=lf`.

---

### 17. `.zip` file committed to repo

**File:** `vanpics-portfolio.zip` (8.6MB)

This is a huge binary sitting in your git history forever. Even if you delete it now, it's in the history. Consider adding `*.zip` to `.gitignore` and using `git filter-repo` to strip it if you care about repo size.

---

## Summary

| Priority | Count | Key Theme |
|----------|-------|-----------|
| 🔴 P0 Critical | 2 | Broken video fallback, accessibility violation |
| 🟠 P1 High | 4 | Scoping bugs, XSS vector, keyboard nav leak |
| 🟡 P2 Medium | 6 | Perf waste, stale state, shadowed globals |
| 🟢 P3 Low | 3 | Missing error states, CSS bloat, target=_blank |
| ⚪ Nitpick | 2 | Line endings, committed zip |

> [!IMPORTANT]
> The video fallback (P0 #1) and the keyboard nav guard (P1 #5) are the two I'd fix **today** — they're both like 2-line fixes that prevent real user-facing breakage.

lmk which ones you wanna tackle and I'll patch them for you bestie 🫡
