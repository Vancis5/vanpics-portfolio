# Task Handoff: Shared Element View Transitions Lightbox Morph

## Objective
Implement a smooth, high-fidelity shared element morph animation when opening and closing the lightbox, matching the reference demo at `C:\Users\Administrator\Downloads\lightbox-demo\lightbox-demo`.

When clicking a thumbnail in the masonry grid, the thumbnail should seamlessly morph into the centered lightbox image position using the native browser View Transitions API (`document.startViewTransition` with `view-transition-name: photo`). When closed, it should morph back into the thumbnail card in the grid.

---

## Bundled Context
Crucial files have been packed into:
`lightbox-transition-repomix.xml` (72,544 tokens)

Contains:
1. **Reference Demo**:
   - `index.html`
   - `style.css`
   - `script.js` (clean native `document.startViewTransition` sample)
2. **Core Lightbox Subsystem**:
   - `js/app/lightbox/controller.ts` (open/close lifecycle, navigation, event listeners)
   - `js/app/lightbox/renderer.ts` (DOM rendering, layout sizing, title/desc)
   - `js/app/lightbox/layout.ts` (dynamic layout modes: phone, tablet-portrait, tablet-landscape, desktop)
   - `js/app/lightbox/types.ts`
   - `js/app/lightbox-media.ts` (photo loading, caching, ratio setting)
   - `js/app/lightbox-cache.ts` (in-memory image decoding/cache)
   - `js/app/lightbox-swap.ts` (full-res swap overlays)
   - `js/app/lightbox-swipe.ts` (touch gesture handling, mobile snap-slides)
3. **Gallery & Styles**:
   - `js/app/gallery.ts` (masonry grid cards, click listener where open is triggered)
   - `css/lightbox.css` (lightbox layout, CSS transitions, view transition pseudo-elements)
   - `css/gallery.css`
   - `index.html`

---

## Current State & Difficulties Encountered

1. **Current Branch:** `lightbox-entry-new`
2. **The Problem:**
   - The transition feels stuttery, flashes, or breaks expected photo scaling.
   - Unlike the demo (which is a trivial single centered `<img>` inside a fixed `#box[hidden]`), this portfolio is a complex production app:
     - **Multi-Layout System:** Mobile (`phone` mode) uses horizontal scroll snapping `#lightbox-img-wrap .snap-slide`. Desktop and `tablet-landscape` use a 2-column flex row (`#lightbox-content`) where the photo area width is constrained by `--lightbox-photo-ratio` and a 380px info sidebar.
     - **Pre-existing Transitions & Overlays:** `#lightbox`, `#lightbox-bg`, `#lightbox-blur-canvas`, and `#lightbox-img-wrap` had opacity transitions and background blur renderers that conflict with the View Transitions root crossfade snapshot.
     - **Timing & Decoding Contention:** In this codebase, clicking a card triggers background color warming (`warmUpAllPhotoColors`), neighbor preloading (`loadSwipeNeighbors`), and canvas blur generation. If `document.startViewTransition` freezes the frame while synchronous operations run, it leads to dropped frames and perceptible lag.
     - **Target Frame Bounding Box Jumps:** On desktop, if `--lightbox-photo-ratio` isn't resolved *before* the new snapshot is captured, the browser transitions the photo to a default ratio box and then snaps when the layout recalculates.

---

## Key Requirements for Implementation

1. **Fidelity:** Must feel butter-smooth (60fps) with zero sudden jumps in aspect ratio or position.
2. **Isolation:** View transitions should only animate the photo element (`::view-transition-group(photo)`), while the lightbox backdrop and info panel fade in cleanly around it without fighting the compositor.
3. **Multi-Engine Safety:** Must not hang or crash on Safari / WebKit or Firefox (Playwright test `tests/vanpics.spec.js:144` must pass on all engines). Fall back cleanly to instant open if View Transitions are unsupported or reduced motion is enabled.
4. **Clean Exit Morph:** Closing via close button or Escape key must locate the active image card in the masonry grid (accounting for navigation) and morph back into that card.
