## 2024-05-14 - Avoiding Layout Thrashing on mousemove
**Learning:** Calling `getBoundingClientRect()` inside high-frequency events like `mousemove` causes forced synchronous layout (layout thrashing) which blocks the main thread. This app uses glowing cursor trackers that follow the mouse, but they were reading layout on every tick.
**Action:** Always cache the element's position on `mouseenter` (as document-relative coordinates) and use `e.pageX/pageY` (which are document-relative) instead of `e.clientX/clientY` to compute relative mouse positions. This completely eliminates synchronous layout reads from the critical animation path.
## 2024-05-15 - Cached `getBoundingClientRect` on mousemove
**Learning:** Found a missing layout caching for `getBoundingClientRect()` inside a wheel/mousemove handler in `cursor.ts`. Repeated layout thrashing when mouse is hovering the filmstrip.
**Action:** Implemented caching for `domRefs.filmstripWrap.getBoundingClientRect()` and clearing it on `scroll` and `resize` events to eliminate synchronous layout reads in the main thread during high frequency wheel events.
