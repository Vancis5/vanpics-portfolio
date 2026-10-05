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

// A/B kill switches: ?perf=1&kill=grain,blur,backdrop,shimmer,items (or kill=all).
// Each name injects one CSS rule that switches a suspect off, so a re-trace shows which one owns the
// heavy raster/GPU tasks. Diagnostic only: inert unless perf is on AND kill= is present, and the
// page looks different on purpose while a switch is active.
//   grain    hide body::after (fixed full-viewport feTurbulence noise)
//   grainz   keep the grain but drop its translateZ(0) promotion (tells noise raster from layer cost)
//   blur     hide #hero-identity::before (radial gradient + filter: blur(30px))
//   backdrop drop every backdrop-filter (header 20px, motion start button 12px)
//   shimmer  hide .loader-shimmer (mix-blend-mode: overlay, startup only)
//   items    drop translateZ(0) from every .carousel-item (one layer per clone today)
// `all` = every switch except grainz (grain already covers it).
const KILL_RULES = new Map<string, string>([
  ['grain', 'body::after{display:none!important}'],
  ['grainz', 'body::after{transform:none!important;-webkit-transform:none!important}'],
  ['blur', '#hero-identity::before{display:none!important}'],
  ['backdrop', '*,*::before,*::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}'],
  ['shimmer', '.loader-shimmer{display:none!important}'],
  ['items', '.carousel-item{transform:none!important;-webkit-transform:none!important}']
]);

function applyKillSwitches(): void {
  let raw = '';
  try {
    raw = new URLSearchParams(location.search).get('kill') || '';
  } catch {
    return;
  }
  const asked = raw.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  if (!asked.length) return;

  const names = new Set<string>();
  const unknown: string[] = [];
  asked.forEach((name) => {
    if (name === 'all') KILL_RULES.forEach((_css, key) => { if (key !== 'grainz') names.add(key); });
    else if (KILL_RULES.has(name)) names.add(name);
    else unknown.push(name);
  });

  const css = Array.from(names).map((name) => KILL_RULES.get(name)).join('\n');
  if (css) {
    const style = document.createElement('style');
    style.id = 'vp-perf-kill';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }
  console.info('[vp perf] kill switches on:', Array.from(names).join(', ') || '(none)');
  if (unknown.length) console.warn('[vp perf] unknown kill names ignored:', unknown.join(', '), '| valid:', Array.from(KILL_RULES.keys()).join(', '), '| all');
}

if (ON) {
  perfMark('main-start');
  applyKillSwitches();
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
