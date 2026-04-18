# Francis Evan — Photography Portfolio
**Current stable version: v14**
Three files: `index.html`, `style.css`, `photos.js`
Static site, no framework, no build step. Deploy by dragging folder to Netlify.

---

## Stack

- **Fonts:** Cormorant Garamond (serif, titles/body), DM Mono (monospace, labels/meta)
- **Colors:** `--bg: #111010`, `--text: #ddd8cf`, `--text-muted` at 48% opacity, `--text-faint` at 22%, `--border` at 9%
- **Grain overlay:** SVG fractalNoise at 4.5% opacity, `position: fixed`, `z-index: 9990`
- **Custom cursor:** 7px dot + 28px ring, desktop only (`hover: hover` + `pointer: fine`), initialized hidden, fades in on first mousemove, fades out on `mouseleave` via both `document` and `document.documentElement` for cross-browser coverage. Delegated `mouseover/mouseout` on document handles dynamically added elements.
- **Photos:** all `.webp`, max 2400px long edge, quality 80-85. Lives in `photos/` folder next to `index.html`.

---

## photos.js

The only file the user edits. Single `const photos = [...]` array. Each entry:

```js
{
  src: "photos/filename.webp",
  title: "the title",           // empty string = hidden everywhere
  desc: "why i took it.",
  year: "2024",
  location: "maasin city, southern leyte",  // empty = omitted from lightbox meta
  heroSlide: true               // true = appears in hero carousel; false = gallery only
}
```

- Photos with empty `title` are filtered out of both carousel and gallery
- First 16 entries are filled with real content, all have `heroSlide: true`
- Remaining 24 are empty scaffolds with `heroSlide: false`

---

## Hero Section

- `100svh`, `overflow: hidden`, flex column, centered
- **3 rows desktop/tablet, 4 rows mobile** — row-3 is hidden via inline style, shown via JS on mobile
- **Carousel:** only `heroSlide: true` photos. Fallback: if none are true, uses all active photos.
- **Animation:** starts at 8x cruise speed, decelerates over 120 frames via `easeOutCubic` to cruise 0.45px/frame
- **Parallax:** each row drifts at different rate on scroll (18%, -12%, 22%, -15%)
- **Row directions:** rows 0+2 go left, rows 1+3 go right
- **Edge fades:** `::before`/`::after` pseudo-elements, 120px wide, fade to `--bg`
- **Amber glow ball:** 600px radial gradient, follows mouse with 8% lerp, desktop only
- **Identity label** (bottom-left) and **scroll hint** (bottom-right): both animate in on load via `fadeup` keyframe

---

## Loading Screen

- Dark overlay with single pulsing dot
- Waits for first set of carousel images to fully load via `onImageReady` counter
- `img.complete` checks use `setTimeout(..., 0)` to always be async (fixes Firefox)
- `window.__onCarouselReady` callback lifts the loader after rows turn visible
- 4-second hard fallback regardless
- `safeLift` guards against double-fire

---

## Gallery (Masonry)

- CSS `columns`: 1 mobile → 2 tablet → 3 desktop
- Cards start `opacity: 0, translateY(20px)`, revealed via scroll event + `getBoundingClientRect`
- **CLS fix:** aspect ratios cached in `localStorage` under key `van_ratios_v1`. On first visit, reads `naturalWidth/naturalHeight` after load and caches. On repeat visits, applies ratio before image loads → zero layout shift.
- Hover: scale(1.03), full brightness/saturation. Overlay with title + year fades in.
- Touch: overlay always visible.

---

## Lightbox

### Layout
- Mobile: column (image on top, info below), `max-height: 52svh` on image, `min-height: 160px` floor prevents info reflow
- Desktop (≥768px): row — image column uses `align-items: center`, info column uses `display: flex; flex-direction: column; justify-content: center` so both sides are independently centered regardless of image height. Image `max-width: 50vw, max-height: 72svh`.
- Desktop wide (≥1024px): `max-width: 1100px` container, image `56vw / 72svh`, info `350px`
- Info panel: `opacity: 0` base, animated in via keyframe `lbInfoIn`
- Desc: `max-width: 38ch` prevents word-by-word wrapping at small effective widths

### Opening
- Blur bg layers reset, `setLightboxContent` called, `img.src` set directly, `animateInfo(0)` fires after 80ms delay

### Navigation (prev/next/keyboard)
- `navGen` counter stamps each navigation — stale callbacks check `gen !== navGen` and bail
- **Exit:** image slides out immediately (0.15s) with directional `translateX`
- `setLightboxContent` updates text + blur bg immediately
- `animateInfo(dir)` fires immediately (directional: slides from right on next, left on prev, up on open)
- **Probe:** `new Image()` preloads target. `doEnter` fires when probe resolves OR after 400ms max wait. Hard fallback at 500ms.
- **Enter:** `img.src = ''` first (blanks element so previous image never shows at new position), then `img.src = p.src` set inside rAF at `opacity: 0`, then fades + slides in over 0.28s/0.36s

### Info animation
- Clone-replace trick: clones `#lightbox-info` node, sets CSS custom properties `--lb-from-x` / `--lb-from-y`, replaces original with clone. Avoids reflow and animation cancel opacity snap.
- Keyframe `lbInfoIn`: from `translateX(var(--lb-from-x)) translateY(var(--lb-from-y)) opacity:0` → to `translate(0,0) opacity:1`

### Blur background
- Two layers: `#lightbox-bg-blur-a` and `#lightbox-bg-blur-b`, stacked via `position: fixed`
- Outer div handles `opacity` transition (0.55s). Inner div `.lightbox-bg-blur-inner` carries `filter: blur(50px) brightness(0.22) saturate(0.65)` — never transitions, so no per-frame blur repaint
- On navigate: incoming layer gets new `backgroundImage`, fades in; outgoing fades out. `blurActive` tracks which is live.

### Swipe (mobile)
- Axis-locked touchmove: locks to `'h'` or `'v'` on first 6px movement
- Horizontal: image physically follows touch at 38% resistance
- Commit threshold: 55px. On commit: exit animation → `swipeNavigate` → enter from opposite side
- `swipeNavigate` is separate from `openLightbox` to avoid double-animating

### Keyboard
- Arrow keys navigate, Escape closes

### Close
- Increments `navGen` to cancel pending callbacks
- Resets `img` inline styles, `info` animation+opacity, blur layers

---

## Filmstrip

- Fixed to bottom of lightbox, `z-index: 10`
- **Visibility:** hidden by default (`opacity: 0, translateY(8px)`). Shows on open (300ms delay), on every navigation, on swipe. Auto-hides after 2.8s. Stays visible while hovering. Mouseout restarts 1.2s timer.
- **Thumbs:** 52px × 38px (desktop: 62px × 44px), `object-fit: cover`, lazy loaded
- **Active indicator:** inactive at 32% opacity, active at 100% + `scaleY(1.12)`
- **Centering:** padding-based — sets `--filmstrip-content-w` CSS var from computed total width; `padding-left/right: max(1.25rem, (100vw - contentW) / 2)`. Works correctly when content overflows (unlike `justify-content: center`).
- **Centering:** padding-based — sets `padding-left/right: (window.innerWidth / 2) - (thumbW / 2)`. This ensures both the first and last images can be centered on the screen when active. No clones or bookends are used.
- **Edge fade:** `mask-image` gradient — transparent → opaque over first 15% and last 15%.
- **Auto-scroll:** scrolls active thumb to center on every update
- **Mouse wheel:** only fires when hovering wrap, scrolls horizontally
- **Click-drag:** `mousedown` on filmstrip, `mousemove`/`mouseup` on document. Suppresses click if dragged >4px via `dragging-moved` class.
- **Background:** gradient from `rgba(13,12,12,0.92)` at bottom to transparent at top

---

## Performance notes

- `display=swap` on Google Fonts, preconnect to both `googleapis.com` and `gstatic.com`
- First 6 carousel images get `<link rel="preload">` injected into `<head>` dynamically
- Carousel images: copy 1 is `loading="eager"`, all subsequent copies are `loading="lazy"`
- `void offsetWidth` reflow eliminated — uses clone-replace for animation reset instead
- `will-change: transform` on carousel rows

---

## Deployment

Drag the whole folder (index.html + style.css + photos.js + photos/) to netlify.com. Color sampling and canvas features require `https://` — broken on `file://` local preview, works fine hosted.
