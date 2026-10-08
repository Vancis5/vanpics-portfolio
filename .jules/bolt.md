## 2024-05-18 - Throttling Scroll Events

**Learning:** Implementing a naive leading-edge-only `throttle` utility for continuous events like 'scroll' drops final state updates and causes functional regressions in scroll-driven logic (e.g. failing to detect end-of-scroll).
**Action:** Always ensure throttle utilities execute on the trailing edge (using timers and timestamps) to guarantee the final state is captured accurately for events like scroll and resize.
