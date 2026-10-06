## 2023-10-24 - Layout Thrashing in Scroll Handlers
**Learning:** `window.getComputedStyle` called synchronously within scroll handlers triggers costly style recalculations.
**Action:** Always cache these values and invalidate them using `resize` event listeners instead.
