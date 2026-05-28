# vanpics Portfolio — Codebase Audit

> Reviewed: `index.html`, `style.css` (1881 lines), `player.css`, `css/*.css`, `public/js/app.js` (2700 lines), `public/js/browser-fixes.js`, `public/js/smooth-scroll.js`, `public/data/photos.js`, `public/data/videos.js`, `package.json`, `.gitignore`, project structure

---

## 🔴 Critical Issues

### 1. `app.js` is a God File (2700 lines, 107KB)
This is the single biggest problem. **Everything** — hero carousel, lightbox, zoom, filmstrip, masonry gallery, custom cursor, custom scrollbar, URL routing, mobile scroll-snap, pinch-to-zoom, swipe-to-dismiss — all lives in one flat procedural file with zero modularization.

**Why this hurts:**
- Any change risks breaking unrelated features
- Impossible to unit test anything
- Mental overhead to navigate 2700 lines of interleaved concerns
- No tree-shaking — mobile loads desktop cursor code and vice versa

**Suggested split:**
| Module | Responsibility |
|---|---|
| `carousel.js` | Hero row animation, buildCarousel, tick loop |
| `lightbox.js` | open/close/navigate, blur management, info panel |
| `zoom.js` | Desktop wheel zoom + mobile pinch-to-zoom |
| `filmstrip.js` | Build, show/hide, drag, scroll sync |
| `masonry.js` | buildMasonry, card reveal, category switching |
| `cursor.js` | Custom cursor + ring (desktop only) |
| `scrollbar.js` | Custom scrollbar controller |
| `router.js` | Hash routing, deep links, popstate |
| `utils.js` | escapeHtml, slugify, isMobile, syncViewport |

### 2. `public/` and `dist/` Are Duplicate Data
Both `public/data/photos.js` and `dist/data/photos.js` are **15KB identical files**. Same for `videos.js`, `app.js`, `browser-fixes.js`, `smooth-scroll.js`. The `dist/` folder is gitignored but it still exists locally, creating confusion about which is the source of truth.

> [!WARNING]
> There's no Vite config file (`vite.config.js`). The `dist/` folder has a built `index.html` and hashed assets (`index-BLCn-q-y.js`, `index-CLbii3y6.css`), but the source architecture doesn't use ES modules at all. Vite is essentially just a dev server here — it's not actually bundling the JS. The `<script>` tags in `index.html` load from `/js/app.js` and `/data/photos.js` as plain global scripts.

### 3. `photos.js` Mixes `const` and `var` Across Files
`photos.js` uses `const photos = [...]` while `videos.js` uses `var videos = [...]` and `app.js` is entirely `var`. This is a consistency smell. More importantly — since these are loaded as global scripts (not modules), `const` in `photos.js` can cause issues if the script is somehow loaded twice or in certain bundler scenarios.

---

## 🟡 Code Smells & Refactoring Opportunities

### 4. 111 `getElementById` Calls — Repeated DOM Lookups
The same elements (`lightbox-img`, `lightbox-content`, `lightbox-info`, `lightbox-img-wrap`, `filmstrip`, etc.) are fetched with `getElementById` over and over inside functions that run on every navigation, every scroll tick, every touch event.

```js
// This pattern appears dozens of times:
var img = document.getElementById('lightbox-img');
var content = document.getElementById('lightbox-content');
var mWrap = document.getElementById('lightbox-img-wrap');
```

**Fix:** Cache these at the top of the file or in a DOM refs object. The elements never change.

### 5. Massive Code Duplication — FLIP Animation
The FLIP animation for `desc-open` collapse appears **three times** with near-identical code:
- Lines 289–323 (mobile branch in `setLightboxContent`)
- Lines 326–358 (desktop branch in `setLightboxContent`)
- Lines 845–876 (`toggleLightboxDesc`)

All three do the same getBoundingClientRect → classList toggle → apply translateY → rAF → clear transition pattern. This should be a single `flipTransition(element, toggleFn)` utility.

### 6. `var` Everywhere Instead of `let`/`const`
498 `var` declarations. Every single variable is `var`, which means:
- No block scoping protection in loops
- Hoisting bugs are possible
- Signals the code was written pre-ES6 or intentionally avoiding modules

### 7. HTML String Concatenation for Complex Markup
The video player markup (`getVideoPlayerMarkup`) is a 30-line `.join('')` of raw HTML strings including inline SVGs. This is fragile, hard to read, and a potential XSS vector if any user data ever flows through it.

```js
// Line 30-58: This is extremely hard to maintain
return [
  '<div class="motion-player-prime" id="motion-player-instance">',
  '<video-player>',
  '<media-container class="media-minimal-skin ...">',
  '<video src="' + item.src + '" ...></video>',
  // ... 25 more lines of SVG paths
].join('');
```

### 8. Inline `onclick` Handlers in HTML
```html
<button id="lightbox-close" onclick="closeLightbox()">close</button>
<div id="scroll-hint" onclick="if(window.lenis){...}">
<button onclick="toggleLightboxDesc()">read more</button>
<button onclick="startUnifiedMotionPlayer('motion-player-instance')">
```
These rely on global function scope and bypass the event system. Should use `addEventListener`.

### 9. No Error Boundaries or Defensive Loading
If `photos.js` fails to load (network error, CDN down), `app.js` will throw immediately on line 120 where it calls `photos.filter(...)`. The `videos` array has a guard (`typeof videos !== 'undefined'`) but `photos` does not.

### 10. Magic Numbers Everywhere
```js
var CRUISE_SPEED = isMobile ? 0.28 : (window.innerWidth < 1024 ? 0.36 : 0.45);
var EASE_FRAMES = 120;
var START_SPEED_MULT = 8.0;
// ...
setTimeout(safeLift, 4000);  // why 4000?
setTimeout(hideFilmstrip, 2800);  // why 2800?
setTimeout(doEnter, 600);  // hard fallback
```
These timing constants are scattered throughout. A config object at the top would make tuning much easier.

### 11. `loadSwipeNeighbors` is Overwritten
On line 887 it's defined as a proper function, then on line 1088 it's reassigned to a no-op, then on line 1419 it's reassigned *again* inside the mobile IIFE to `updateLoading()`. This shadowing pattern is really confusing.

---

## 🟢 Structural / Project Issues

### 12. CSS is Also Very Large (41KB + 25KB + 4KB + 17KB + 1KB)
- `style.css` — 1881 lines, 41KB
- `player.css` — 25KB
- `css/media-minimal-skin.css` — 17KB
- `css/runtime-effects.css` — 4KB
- `css/motion-section.css` — 1KB

Total: ~88KB of CSS. `style.css` has some duplicated rules (e.g. `#filmstrip-lift-zone` is defined twice at lines 1575-1587 and 1589-1601 — literally identical blocks).

### 13. Missing `<link rel="preload">` for Critical Assets
The hero carousel eagerly pre-caches the first 6 images via JS (`new Image()`) — but this happens *after* parse. The fonts from Google Fonts are `preconnect` but the critical CSS files aren't prioritized at all.

### 14. No `package.json` `name` or `version` Field
```json
{
  "devDependencies": { "vite": "^8.0.8" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "sort": "node scripts/sort-photos.js"
  }
}
```
Missing `name`, `version`, `description`, `license`. Also missing scripts for the other tooling (`add-ratios`, `generate-thumbs`, `generate-blur`).

### 15. `browser-fixes.js` References Non-Existent Script
```js
document.write('<script src="scripts/firefox.js"><\/script>');
```
But `firefox.js` is gitignored (line 31 of `.gitignore`) and doesn't exist in the repo. So this `document.write` call either does nothing or throws a 404 on Firefox.

### 16. External CDN Dependencies Without Fallbacks
- `https://cdn.jsdelivr.net/npm/@videojs/html/cdn/video-minimal-ui.js` — no SRI hash, no fallback
- `https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.min.js` — pinned version but no SRI
- Google Fonts — preconnect but render-blocking

---

## 📋 Refactoring Priority

| Priority | Task | Impact |
|---|---|---|
| **P0** | Split `app.js` into modules | Maintainability, testability, sanity |
| **P0** | Add Vite config + use ES module imports | Actually leverage the bundler you're paying for |
| **P1** | Cache DOM refs | Performance on every interaction |
| **P1** | Extract FLIP animation utility | Kill ~60 lines of duplication |
| **P1** | Fix `photos.js` defensive guard | Prevent crash on load failure |
| **P2** | Replace inline `onclick` with `addEventListener` | Separation of concerns |
| **P2** | Consolidate magic numbers into config | Tunability |
| **P2** | Remove duplicate CSS rules | Clean up 88KB of CSS |
| **P3** | Add SRI hashes to CDN scripts | Security |
| **P3** | Complete `package.json` metadata | Project hygiene |
| **P3** | Fix `browser-fixes.js` firefox.js reference | Dead code |

---

## 💭 Overall Assessment

The site itself is **genuinely beautiful** — the design language, animations, and attention to performance (blur pre-gen, resource pausing, CLS prevention) show real craft. The *visual* execution is premium.

But the code is a **one-person, stream-of-consciousness monolith**. It works because you understand every line, but it's technically fragile. The 2700-line God File with 498 `var` declarations and 111 repeated DOM lookups is the kind of thing that'll make you cry when you come back to add a feature in 6 months.

The good news? The architecture is *conceptually* clean — the concerns (carousel, lightbox, filmstrip, masonry) are already logically grouped in the file. Splitting them into modules would be a relatively mechanical refactor, not a rewrite.
