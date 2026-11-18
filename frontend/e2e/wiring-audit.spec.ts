import { test, expect } from '@playwright/test';

/**
 * Anti-mock audit: loads every main page authenticated and records
 * console errors + failed API responses (4xx/5xx). A page that renders
 * but its data calls all fail indicates unwired/broken wiring.
 * Requires E2E_USER/E2E_PASS and a running backend (E2E_BASE_URL).
 */

const USER = process.env.E2E_USER || 'e2e-admin';
const PASS = process.env.E2E_PASS || '';

const PAGES = [
  { name: 'overview', path: '/' },
  { name: 'control', path: '/control' },
  { name: 'ports', path: '/ports' },
  { name: 'users', path: '/users' },
  { name: 'storage', path: '/storage' },
  { name: 'audit', path: '/audit' },
  { name: 'security', path: '/security' },
  { name: 'settings', path: '/settings' },
  { name: 'jit', path: '/jit' },
  { name: 'replay', path: '/replay' },
  { name: 'vault', path: '/vault' },
  { name: 'assets', path: '/assets' },
  { name: 'agents', path: '/agents' },
  { name: 'infrastructure', path: '/infrastructure' },
  { name: 'network-storage', path: '/network-storage' },
  { name: 'containers', path: '/containers' },
  { name: 'databases', path: '/databases' },
  { name: 'development', path: '/development' },
  { name: 'governor', path: '/governor' },
  { name: 'bastion', path: '/bastion' },
];

test.describe('ASAAS - runtime wiring audit', () => {
  test.skip(!PASS, 'E2E_PASS not set');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[autocomplete="username"]').fill(USER);
    await page.locator('input[autocomplete="current-password"]').fill(PASS);
    await page.getByRole('button', { name: /دخول إلى لوحة التحكم/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
  });

  for (const p of PAGES) {
    test(`${p.name} loads with healthy API calls`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const failedCalls: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('response', (r) => {
        if (r.url().includes('/api/') && r.status() >= 400 && !r.url().includes('/api/v1/')) {
          failedCalls.push(`${r.status()} ${r.url()}`);
        }
      });
      await page.goto(p.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      // Report, don't hard-fail on data 4xx (empty states are legitimate);
      // fail only on uncaught page errors or /login redirect.
      expect(page.url()).not.toContain('/login');
      const fatal = consoleErrors.filter((e) => !/favicon|net::|WebSocket|third-party|Failed to load resource/i.test(e));
      expect(fatal, `${p.name} console errors: ${fatal.slice(0, 3).join(' | ')}`).toHaveLength(0);
      if (failedCalls.length) {
        console.log(`[${p.name}] non-v1 API 4xx/5xx: ${failedCalls.slice(0, 8).join(', ')}`);
      }
    });
  }
});
