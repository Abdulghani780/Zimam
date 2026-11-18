import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Phase 0.6/0.7 coverage: ≤900px navigation containment across all pages,
 * plus the 375/768/1280 × light/dark screenshot matrix.
 */

const screenshotDir = path.resolve('..', 'docs', 'visual-audit-screenshots', 'matrix');

const pagesToAudit = [
  { name: '01_Overview', path: '/' },
  { name: '02_Resource_Governor', path: '/control' },
  { name: '03_Ports_Radar', path: '/ports' },
  { name: '04_Users_Directory', path: '/users' },
  { name: '05_Storage_Files', path: '/storage' },
  { name: '06_Audit_Compliance', path: '/audit' },
  { name: '07_Security_Shield', path: '/security' },
  { name: '08_Settings', path: '/settings' },
  { name: '09_JIT_Elevation', path: '/jit' },
  { name: '10_Session_Replay', path: '/replay' },
  { name: '11_Vault_Credentials', path: '/vault' },
  { name: '12_Managed_Assets', path: '/assets' },
];

const WIDTHS = [375, 768, 900, 1280] as const;
const SHOT_WIDTHS = [375, 768, 1280] as const;
const THEMES = ['light', 'dark'] as const;

async function setTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.addInitScript((t) => {
    try { window.localStorage.setItem('asaas-theme', t); } catch { /* ignore */ }
  }, theme);
}

test.describe('ASAAS - Viewport containment matrix (≤900px nav)', () => {
  for (const width of WIDTHS) {
    test(`No horizontal overflow @ ${width}px across all pages`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      for (const p of pagesToAudit) {
        await page.goto(p.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(400);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${p.name} overflows horizontally @ ${width}px`).toBeLessThanOrEqual(2);
      }
    });
  }

  test('Mobile tabbar visible ≤900px, hidden >900px', async ({ page }) => {
    for (const width of [375, 768, 900] as const) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.mobile-tabbar')).toBeVisible({ timeout: 10000 });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await expect(page.locator('.mobile-tabbar')).toBeHidden();
  });
});

test.describe('ASAAS - Screenshot matrix 375/768/1280 × light/dark', () => {
  test.beforeAll(() => {
    fs.mkdirSync(screenshotDir, { recursive: true });
  });

  for (const theme of THEMES) {
    for (const width of SHOT_WIDTHS) {
      test(`Screenshots @ ${width}px ${theme}`, async ({ page }) => {
        await setTheme(page, theme);
        await page.setViewportSize({ width, height: width <= 768 ? 844 : 900 });
        for (const p of pagesToAudit) {
          await page.goto(p.path, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(700);
          await page.screenshot({
            path: path.join(screenshotDir, `${p.name}__${width}__${theme}.png`),
            fullPage: false,
          });
        }
      });
    }
  }
});
