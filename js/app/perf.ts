// js/app/perf.ts — diagnostics only, silent unless ?perf=1 or localStorage.vpPerf=1
const ON = (() => {
  try {
    return /[?&]perf=1\b/.test(location.search) || localStorage.getItem('vpPerf') === '1';
  } catch {
    return false;
  }
})();

export function perfMark(n: string): void {
  if (ON) performance.mark('vp:' + n);
}

export function perfMeasure(n: string, a: string, b?: string): void {
  if (ON) {
    try {
      performance.measure('vp:' + n, 'vp:' + a, b ? 'vp:' + b : undefined);
    } catch {
      /* ignore */
    }
  }
}

if (ON) {
  perfMark('main-start');
  const rows: unknown[] = [];
  try {
    const type = PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
      ? 'long-animation-frame'
      : 'longtask';
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as any[]) {
        rows.push({
          start: Math.round(e.startTime),
          ms: Math.round(e.duration),
          scripts: (e.scripts || []).map((s: any) => `${s.sourceFunctionName || s.invoker || '?'}@${String(s.sourceURL || '').split('/').pop()}:${s.sourceCharPosition}`).join(' | ')
        });
      }
    }).observe({ type, buffered: true } as PerformanceObserverInit);
  } catch {
    /* unsupported */
  }

  window.addEventListener('load', () => setTimeout(() => {
    console.table(performance.getEntriesByType('measure').filter((m) => m.name.startsWith('vp:')).map((m) => ({
      name: m.name,
      start: Math.round(m.startTime),
      ms: Math.round(m.duration)
    })));
    console.table(rows);
  }, 6000));
}
