import { test, expect } from '@playwright/test';

/**
 * CI smoke suite: exercises the real login flow and core journeys.
 * Requires a running backend on :8765 with a bootstrapped admin account
 * (credentials injected via E2E_USER / E2E_PASS env vars).
 */

const USER = process.env.E2E_USER || 'e2e-admin';
const PASS = process.env.E2E_PASS || '';

test.describe('ASAAS smoke', () => {
  test.skip(!PASS, 'E2E_PASS not set — skipping authenticated smoke tests');

  test('SMK-01: login and reach the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[autocomplete="username"]').fill(USER);
    await page.locator('input[autocomplete="current-password"]').fill(PASS);
    const loginRespPromise = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login'),
      { timeout: 20000 },
    ).catch(() => null);
    await page.getByRole('button', { name: /دخول إلى لوحة التحكم/ }).click();
    const loginResp = await loginRespPromise;
    if (loginResp) {
      const body = await loginResp.text().catch(() => '<unreadable>');
      console.log(`[SMK-01] login POST ${loginResp.url()} -> ${loginResp.status()} ${body.slice(0, 300)}`);
    } else {
      console.log('[SMK-01] no /api/auth/login request observed');
    }
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
    await expect(page.locator('h1, h2, .page-title').first()).toBeVisible({ timeout: 15000 });
  });

  test('SMK-02: theme toggle flips to light and back', async ({ page }) => {
    // The login page exposes the theme toggle directly.
    await page.goto('/login');
    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    await page.getByRole('button', { name: /الوضع (النهاري|الليلي)/ }).first().click();
    await expect(html).not.toHaveAttribute('data-theme', before ?? '');
  });

  test('SMK-03: no horizontal overflow on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/login');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(overflow).toBe(false);
  });

  test('SMK-04: governor page renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      // Ignore the transient 401 emitted while the session cookie propagates.
      if (m.type() === 'error' && !/401|Unauthorized/.test(m.text())) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/login');
    await page.locator('input[autocomplete="username"]').fill(USER);
    await page.locator('input[autocomplete="current-password"]').fill(PASS);
    await page.getByRole('button', { name: /دخول إلى لوحة التحكم/ }).click();
    await page.waitForLoadState('networkidle');
    await page.goto('/governor');
    await page.waitForTimeout(2500);
    expect(errors).toEqual([]);
  });
});
