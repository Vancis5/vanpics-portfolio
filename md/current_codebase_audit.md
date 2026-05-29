# vanpics Portfolio - Current Codebase Audit

Reviewed: 2026-05-29

Scope: `index.html`, `style.css`, `player.css`, `css/*.css`, `public/js/app/*.js`, `public/js/*.js`, `public/data/*.js`, `public/vendor`, `vite.config.js`, `package.json`, `.gitignore`

This audit replaces the older notes in `codebase_audit.md` and `another_codebase_audit.md` where those notes no longer match the current repo. The app is no longer a single `app.js` god file, Vite config exists, package metadata exists, and some earlier XSS/scoping findings have already been fixed.

Update: the non-P0 items in this audit have since been tackled. The viewport zoom lock remains intentionally deferred because that behavior is deliberate for this site.

## Best Issues To Tackle Next

### P0 - Accessibility zoom is blocked

File: `index.html`

The viewport tag still disables user scaling:

```html
content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
```

This prevents browser pinch zoom on some devices and causes accessibility audit failures. The lightbox has its own contextual zoom behavior, so the page-level viewport does not need to lock scaling.

Recommended fix:

```html
content="width=device-width, initial-scale=1.0, viewport-fit=cover"
```

Impact: high accessibility win, tiny patch.

### P1 - Lightbox keyboard shortcuts run when the lightbox is closed

File: `public/js/app/lightbox.js`

The global `keydown` listener currently handles Escape, ArrowRight, and ArrowLeft without first checking whether the lightbox is open:

```js
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeLightbox();
  }
  if (e.key === 'ArrowRight') navigateLightbox(1);
  if (e.key === 'ArrowLeft') navigateLightbox(-1);
});
```

This means arrow keys can navigate stale lightbox state while the normal page is active. It would also hijack caret movement if an input/search field is added later.

Recommended fix:

- Ignore events when `domRefs.lightbox` is not open.
- Ignore events whose target is an input, textarea, select, or contenteditable node.

Impact: small patch, prevents weird navigation bugs.

### P1 - Mobile masonry always uses at least three columns

File: `public/js/app/gallery.js`

`buildMasonry()` chooses only between four columns and three columns:

```js
let numCols = (window.innerWidth >= 1024) ? 4 : 3;
```

On narrow phones, three columns makes thumbnails very small. The CSS may visually soften this, but the JS still distributes cards into three columns.

Recommended fix:

- `>= 1024`: four columns
- `>= 640`: three columns
- otherwise: two columns, or one column if you want a slower editorial mobile feed

Impact: noticeable mobile polish with low implementation risk.

### P2 - External description link is missing `rel`

File: `public/data/photos.js`

One photo description includes:

```html
target='_blank'
```

without `rel="noopener noreferrer"`. Because descriptions are intentionally injected as HTML for links and breaks, external links should include the safer `rel` attribute.

Impact: tiny security hygiene fix.

### P2 - Failed full-size image loads have no visible error state

File: `public/js/app/lightbox.js`

When the full-size image fails in the lightbox, `img.onerror` clears handlers but does not show a fallback or error message. The user can be left looking at a loading/shimmer state.

Recommended fix:

- Keep the blur/thumb preview visible if the full image fails.
- Add a small non-blocking "image failed to load" state inside the lightbox frame.

Impact: good UX hardening, slightly more design work than the quick fixes above.

## Worth Tackling Later

### Rename the global `scrollY` variable

Files: `public/js/app/hero-carousel.js`, `public/js/smooth-scroll.js`

`hero-carousel.js` defines:

```js
let scrollY = 0;
```

and `smooth-scroll.js` assigns to `scrollY` in the shared global scroll hub. This shadows the browser's `window.scrollY` name and makes the cross-file coupling hard to read.

Recommended fix: rename it to `heroScrollY` in both files.

Impact: maintainability cleanup. Verify hero parallax after patching.

### Reduce permanent `will-change` declarations

Files: `style.css`, `player.css`, `css/runtime-effects.css`, `css/media-minimal-skin.css`

There are many permanent `will-change` declarations. A few are useful for the carousel, lightbox, and cursor, but keeping many elements permanently promoted can waste memory and hurt lower-end devices.

Recommended fix:

- Keep only the high-confidence hot paths.
- Move some `will-change` usage to active animation classes if needed.
- Verify in browser because this is visual/performance-sensitive.

Impact: possible mobile performance win, but needs careful QA.

### Cursor ring animation runs forever on pointer devices

File: `public/js/app/cursor.js`

The custom cursor ring starts a recursive `requestAnimationFrame` loop and never cancels it:

```js
(function animateRing() { ... requestAnimationFrame(animateRing); })();
```

This is probably acceptable on desktop for a small portfolio, but it is still wasted work when the cursor is hidden or the document is not visible.

Recommended fix: keep the animation id, pause on `visibilitychange`/hide, and restart on visible pointer movement.

Impact: minor performance polish.

### Data files still use global `var`

Files: `public/data/photos.js`, `public/data/videos.js`

The current plain-script architecture intentionally exposes `photos` and `videos` as globals. That works, but it is fragile compared with module imports.

Recommended fix: leave this alone unless you decide to convert the app scripts to modules. Do not do a one-off `const` change without checking script load and redeclaration behavior.

Impact: architecture cleanup, not an urgent bug.

## Already Fixed Or Stale Findings From Older Audits

### App code is no longer one giant `app.js`

Current app modules:

- `bootstrap.js`
- `config.js`
- `core.js`
- `cursor.js`
- `custom-scrollbar.js`
- `filmstrip.js`
- `gallery.js`
- `hero-carousel.js`
- `lightbox-swipe.js`
- `lightbox-zoom.js`
- `lightbox.js`

There are still large modules, especially `lightbox.js`, `lightbox-swipe.js`, and `gallery.js`, but the old "2700-line god file" finding is no longer current.

### Vite config and package metadata exist

`vite.config.js` exists and copies photos/icons/preview assets into `dist`.

`package.json` has `name`, `version`, `description`, `private`, `license`, and scripts for build and media generation.

### Gallery overlay XSS finding is stale

`public/js/app/gallery.js` now creates overlay title/date nodes and assigns `textContent`, not raw `innerHTML`.

### `animateGlow` strict-mode finding is stale

`public/js/app/core.js` now declares `var animateGlow = null` outside the glow block before assigning the function, so `bootstrap.js` can find it reliably.

### Video fallback missing files finding appears stale

`public/vendor/video-minimal-ui.js` imports:

```js
import "./minimal-ui-B0PWg1gR.js";
import "./minimal-D-o7FGL2.js";
```

Both imported files are present in `public/vendor`.

### Build output and archives are ignored

`.gitignore` already includes `dist/`, logs, `photos-raw/`, and `*.zip`. The local `dist` and zip file can still exist in the workspace without being active source files.

## Suggested Patch Order

1. Fix viewport zoom, lightbox keyboard guard, and external link `rel`.
2. Adjust mobile masonry column breakpoints and test at phone/tablet widths.
3. Add a lightbox failed-image state.
4. Rename `scrollY` to `heroScrollY` and smoke-test scroll/parallax.
5. Audit `will-change` declarations with browser verification.

Suggested commit name for the first patch batch:

```text
fix accessibility and lightbox interaction polish
```
