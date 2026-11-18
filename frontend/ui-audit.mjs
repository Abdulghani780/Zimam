// DOM-based layout audit: flags clipped text, viewport overflow, and
// sibling bounding-box collisions that typically render as "تداخل".
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:8876';
const out = process.argv[3] || 'ui-audit-shots';
mkdirSync(out, { recursive: true });

const routes = [
  '/', '/servers', '/agents', '/assets', '/infrastructure', '/security',
  '/storage', '/control', '/ports', '/network-storage', '/containers',
  '/databases', '/governor', '/development', '/users', '/vault', '/audit',
  '/settings', '/session-replay', '/perimeter-lockout',
];

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const user = process.env.ASAAS_USER || 'Abdulghani';
  const pass = process.env.ASAAS_PASS || '';
  const res = await ctx.request.post(`${base}/api/v1/auth/login`, { data: { username: user, password: pass } });
  console.log(`[${vp.name}] login:`, res.status());
  if (!res.ok()) { await ctx.close(); continue; }

  const report = {};
  for (const r of routes) {
    try {
      await page.goto(`${base}${r}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);
      const issues = await page.evaluate(detector);
      report[`${vp.name}${r}`] = issues;
      if (issues.length) console.log(`[${vp.name}]`, r, '→', issues.length);
    } catch (e) {
      report[`${vp.name}${r}`] = [{ kind: 'NAV-FAIL', detail: e.message.split('\n')[0] }];
      console.log(`[${vp.name}] FAIL`, r);
    }
  }
  writeFileSync(join(out, `layout-report-${vp.name}.json`), JSON.stringify(report, null, 2));
  await ctx.close();
}
await browser.close();
console.log('done');

function detector() {
  const issues = [];
  const vw = document.documentElement.clientWidth;

  // Visible rect = bounding rect clipped by every overflow-hidden/auto/scroll
  // ancestor. Bounding boxes alone lie inside scrollers (RTL tables etc.).
  const clipRect = (el, r) => {
    let left = r.left, top = r.top, right = r.right, bottom = r.bottom;
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (/(hidden|auto|scroll|clip)/.test(cs.overflowX + ' ' + cs.overflowY)) {
        const pr = p.getBoundingClientRect();
        left = Math.max(left, pr.left); right = Math.min(right, pr.right);
        top = Math.max(top, pr.top); bottom = Math.min(bottom, pr.bottom);
      }
      p = p.parentElement;
    }
    return { left, top, right, bottom, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
  };
  const visRect = (el) => clipRect(el, el.getBoundingClientRect());
  const desc = (el) => `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} "${(el.textContent || '').trim().slice(0, 40)}"`;

  // 1) Horizontal page overflow
  if (document.documentElement.scrollWidth > vw + 2) {
    issues.push({ kind: 'page-x-overflow', detail: `scrollWidth=${document.documentElement.scrollWidth} > ${vw}` });
  }

  // 2) Clipped text: element's content wider/taller than its own box
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    // content-visibility:hidden (closed <details>) keeps layout boxes but
    // paints nothing — skip so we don't flag invisible content.
    if (el.checkVisibility && !el.checkVisibility({ checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    // Graceful truncation (ellipsis + title tooltip) is intentional design.
    const graceful = cs.textOverflow === 'ellipsis' || cs.getPropertyValue('-webkit-text-overflow') === 'ellipsis';
    // scrollWidth lies in RTL (overflow extends inline-start). Measure the
    // actual text Range rect against the element's own box instead.
    let textOverflows = false;
    if (hasText && !graceful && cs.overflowX !== 'visible') {
      const range = document.createRange();
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        range.selectNodeContents(n);
        const tr = range.getBoundingClientRect();
        if (tr.width > 0 && (tr.left < r.left - 2 || tr.right > r.right + 2)) { textOverflows = true; break; }
      }
    }
    if (textOverflows) {
      issues.push({ kind: 'text-clipped-x', detail: `${desc(el)} sw=${el.scrollWidth} cw=${el.clientWidth}` });
    }
    // element visibly sticking out of viewport (after clip)
    const v = visRect(el);
    if (v.w > 0 && (v.right > vw + 4 || v.left < -4)) {
      issues.push({ kind: 'offscreen-x', detail: `${desc(el)} visRight=${Math.round(v.right)} visLeft=${Math.round(v.left)}` });
    }
  }

  // 3) Visible text collisions: leaf-ish text elements whose VISIBLE boxes overlap
  const texts = [...document.querySelectorAll('h1,h2,h3,h4,p,span,td,th,button,a,label,li')]
    .filter(el => {
      const v = visRect(el);
      const cs = getComputedStyle(el);
      return v.w > 10 && v.h > 8 && cs.visibility !== 'hidden' && cs.display !== 'none'
        && !(el.checkVisibility && !el.checkVisibility({ checkVisibilityCSS: true }))
        && el.children.length <= 3 && el.textContent.trim().length > 3;
    })
    .map(el => ({ el, v: visRect(el), t: el.textContent.trim().slice(0, 50) }));

  const seen = new Set();
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.v.right, b.v.right) - Math.max(a.v.left, b.v.left);
      const oy = Math.min(a.v.bottom, b.v.bottom) - Math.max(a.v.top, b.v.top);
      if (ox > 8 && oy > 8) {
        const area = ox * oy;
        const minArea = Math.min(a.v.w * a.v.h, b.v.w * b.v.h);
        if (area > minArea * 0.35) {
          const key = a.t.slice(0,20) + '||' + b.t.slice(0,20);
          if (seen.has(key)) continue;
          seen.add(key);
          issues.push({ kind: 'text-overlap', detail: `"${a.t}" × "${b.t}"` });
          if (issues.length > 60) return issues;
        }
      }
    }
  }
  return issues.slice(0, 60);
}
