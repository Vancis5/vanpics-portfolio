#!/usr/bin/env node
/**
 * verify-css.cjs
 *
 * Proves a CSS split did not change the cascade, without screenshots or timing.
 *
 * Why this works: the browser's cascade depends only on the ordered list of parsed rules
 * (plus each sheet's media attribute). If that ordered list is identical before and after a split,
 * no element can render differently. Scripts, images, fonts and media are blocked while checking,
 * so nothing animated, random or time-based can influence the result.
 *
 * Usage:
 *   node scripts/verify-css.cjs snapshot            # run ONCE on the untouched original
 *   node scripts/verify-css.cjs check               # run after every carve
 *
 * Options:
 *   --base  http://127.0.0.1:5199     dev server (or vite preview) URL
 *   --root  .                         project root, used to read the html and css files from disk
 *   --pages index.html,login.html,admin.html
 *   --snap  audit/css-snapshot.json
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let chromium;
try { ({ chromium } = require('@playwright/test')); } catch (e) { ({ chromium } = require('playwright')); }

const argv = process.argv.slice(2);
const mode = argv[0];
function opt(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : dflt;
}
const BASE = opt('base', 'http://127.0.0.1:5199').replace(/\/$/, '');
const ROOT = path.resolve(opt('root', '.'));
const PAGES = opt('pages', 'index.html,login.html,admin.html').split(',').map(s => s.trim()).filter(Boolean);
const SNAP = path.resolve(opt('snap', 'audit/css-snapshot.json'));

const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');

// ---------- disk side: concatenate every linked stylesheet in document order ----------
function diskConcat(pageFile) {
  const htmlPath = path.join(ROOT, pageFile);
  if (!fs.existsSync(htmlPath)) return { error: 'html not found on disk: ' + htmlPath };
  const html = fs.readFileSync(htmlPath, 'utf8');
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const hrefs = [];
  for (const t of tags) {
    if (!/\brel\s*=\s*["']?[^"'>]*\bstylesheet\b/i.test(t)) continue;
    const m = t.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (m) hrefs.push(m[1]);
  }
  const bufs = [];
  const missing = [];
  const external = [];
  for (const h of hrefs) {
    if (/^(https?:)?\/\//i.test(h)) { external.push(h); continue; }
    const clean = h.split(/[?#]/)[0].replace(/^\.?\//, '');
    const candidates = [path.join(ROOT, clean), path.join(ROOT, 'public', clean)];
    const hit = candidates.find(c => fs.existsSync(c));
    if (!hit) { missing.push(h); continue; }
    bufs.push(fs.readFileSync(hit));
  }
  return { hrefs, external, missing, concatHash: sha(Buffer.concat(bufs)), bytes: Buffer.concat(bufs).length };
}

// ---------- browser side: ordered, flattened list of parsed rules ----------
async function collect(browser, pageFile) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const sheetResponses = [];
  page.on('response', (r) => {
    if (r.request().resourceType() === 'stylesheet') {
      sheetResponses.push({ url: r.url(), status: r.status(), type: (r.headers()['content-type'] || '') });
    }
  });
  await page.route('**/*', (route) => {
    const t = route.request().resourceType();
    if (t === 'script' || t === 'image' || t === 'media' || t === 'font') return route.abort();
    return route.continue();
  });
  const resp = await page.goto(BASE + '/' + pageFile, { waitUntil: 'load', timeout: 30000 });
  const status = resp ? resp.status() : 0;
  // every <link rel=stylesheet> must have produced a sheet
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('link[rel~="stylesheet"]')).every(l => !!l.sheet),
    { timeout: 10000 }
  ).catch(() => {});

  const data = await page.evaluate(() => {
    function flat(rules, out) {
      for (const r of Array.from(rules)) {
        out.push(r.cssText);
        if (r.type === 3 && r.styleSheet) {      // @import: include the imported rules too
          try { flat(r.styleSheet.cssRules, out); } catch (e) { out.push('<<import inaccessible>>'); }
        }
      }
    }
    const sheets = [];
    for (const s of Array.from(document.styleSheets)) {
      const info = {
        kind: s.ownerNode ? s.ownerNode.tagName.toLowerCase() : 'adopted',
        href: s.href ? new URL(s.href).pathname : null,
        media: s.media ? s.media.mediaText : '',
        disabled: s.disabled,
        rules: []
      };
      try { flat(s.cssRules, info.rules); } catch (e) { info.error = String(e.message || e); }
      sheets.push(info);
    }
    const links = Array.from(document.querySelectorAll('link[rel~="stylesheet"]')).map(l => ({
      href: l.getAttribute('href'), loaded: !!l.sheet, media: l.media
    }));
    return { sheets, links };
  });
  await context.close();

  const rules = [];
  for (const s of data.sheets) {
    for (const r of s.rules) rules.push(s.media + '\u0001' + r);
  }
  return {
    httpStatus: status,
    sheetResponses,
    links: data.links,
    sheetSummary: data.sheets.map(s => ({ kind: s.kind, href: s.href, media: s.media, ruleCount: s.rules.length, error: s.error || null, disabled: s.disabled })),
    rules,
    flatHash: sha(JSON.stringify(rules))
  };
}

async function captureAll(browser) {
  const out = {};
  for (const p of PAGES) {
    const web = await collect(browser, p);
    const disk = diskConcat(p);
    out[p] = { web, disk };
  }
  return out;
}

function problems(pageName, cur) {
  const errs = [];
  if (cur.web.httpStatus !== 200) errs.push(`${pageName}: page returned HTTP ${cur.web.httpStatus}`);
  for (const l of cur.web.links) if (!l.loaded) errs.push(`${pageName}: <link href="${l.href}"> did not produce a stylesheet`);
  for (const r of cur.web.sheetResponses) {
    if (r.status !== 200) errs.push(`${pageName}: ${r.url} returned ${r.status}`);
    else if (!/text\/css/i.test(r.type)) errs.push(`${pageName}: ${r.url} content-type is "${r.type}", expected text/css`);
  }
  for (const s of cur.web.sheetSummary) if (s.error) errs.push(`${pageName}: could not read rules of ${s.href || s.kind}: ${s.error}`);
  if (cur.disk.error) errs.push(`${pageName}: ${cur.disk.error}`);
  if (cur.disk.missing && cur.disk.missing.length) errs.push(`${pageName}: linked css not found on disk: ${cur.disk.missing.join(', ')}`);
  return errs;
}

function compare(pageName, ref, cur) {
  const errs = [];
  // 1. byte-level: concatenation of all linked css files, in link order
  if (ref.disk.concatHash !== cur.disk.concatHash) {
    errs.push(`${pageName}: BYTE MISMATCH. Concatenated linked css differs from the original (${ref.disk.bytes} bytes before, ${cur.disk.bytes} after).`);
  }
  // 2. semantic: ordered list of parsed rules as the browser sees them
  if (ref.web.flatHash !== cur.web.flatHash) {
    const a = ref.web.rules, b = cur.web.rules;
    if (a.length !== b.length) errs.push(`${pageName}: RULE COUNT changed: ${a.length} before, ${b.length} after.`);
    const sa = [...a].sort().join('\n'), sb = [...b].sort().join('\n');
    if (sa === sb && a.length === b.length) errs.push(`${pageName}: same rules but in a DIFFERENT ORDER (cascade changed).`);
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    const show = (x) => (x === undefined ? '<none>' : x.replace('\u0001', ' | media=').slice(0, 160));
    errs.push(`${pageName}: first divergence at rule #${i}\n      before: ${show(a[i])}\n      after:  ${show(b[i])}`);
  }
  // 3. link order of stylesheets (non-split sheets must stay in the same relative order)
  return errs;
}

(async () => {
  if (mode !== 'snapshot' && mode !== 'check') {
    console.error('usage: node scripts/verify-css.cjs snapshot|check [--base URL] [--root DIR] [--pages a,b] [--snap file]');
    process.exit(2);
  }
  const browser = await chromium.launch({ headless: true });
  try {
    if (mode === 'snapshot') {
      const a = await captureAll(browser);
      const b = await captureAll(browser);   // determinism gate: two captures must agree exactly
      const errs = [];
      for (const p of PAGES) {
        errs.push(...problems(p, a[p]));
        if (a[p].web.flatHash !== b[p].web.flatHash || a[p].disk.concatHash !== b[p].disk.concatHash) {
          errs.push(`${p}: snapshot is not deterministic (two captures differ). Do not proceed.`);
        }
      }
      if (errs.length) { console.error('SNAPSHOT FAILED:\n  ' + errs.join('\n  ')); process.exit(1); }
      fs.mkdirSync(path.dirname(SNAP), { recursive: true });
      fs.writeFileSync(SNAP, JSON.stringify({ created: new Date().toISOString(), pages: a }, null, 1));
      for (const p of PAGES) {
        console.log(`[snapshot] ${p}: ${a[p].web.rules.length} rules across ${a[p].web.sheetSummary.length} sheets, ${a[p].disk.bytes} bytes of linked css`);
      }
      console.log('Snapshot saved to ' + SNAP);
      return;
    }

    // check
    if (!fs.existsSync(SNAP)) { console.error('No snapshot at ' + SNAP + '. Run "snapshot" on the untouched original first.'); process.exit(2); }
    const ref = JSON.parse(fs.readFileSync(SNAP, 'utf8')).pages;
    const cur = await captureAll(browser);
    const errs = [];
    for (const p of PAGES) {
      if (!ref[p]) { errs.push(`${p}: not in snapshot`); continue; }
      errs.push(...problems(p, cur[p]));
      errs.push(...compare(p, ref[p], cur[p]));
    }
    if (errs.length) {
      console.error('CSS CHECK FAILED:\n  ' + errs.join('\n  '));
      process.exit(1);
    }
    for (const p of PAGES) {
      console.log(`[ok] ${p}: ${cur[p].web.rules.length} rules identical and in the same order; ${cur[p].web.sheetSummary.length} sheets; all 200 text/css`);
    }
    console.log('CSS CHECK PASSED');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('Harness error:', e); process.exit(1); });
