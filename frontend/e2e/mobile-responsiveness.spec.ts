import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_USER || 'e2e-admin';
const E2E_PASS = process.env.E2E_PASS || '';

test.beforeEach(async ({ page }) => {
  test.skip(!E2E_PASS, 'E2E_PASS not set — skipping authenticated UI audits');
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[autocomplete="username"]').fill(E2E_USER);
  await page.locator('input[autocomplete="current-password"]').fill(E2E_PASS);
  await page.getByRole('button', { name: /دخول إلى لوحة التحكم/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
});

test.describe('ASAAS - Mobile Responsiveness & Containment', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // Modern Mobile Viewport

  test('MOB-01: Mobile viewport displays bottom navigation and prevents horizontal shift', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify page container does not overflow horizontally
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 2); // 0 or max 2px subpixel rounding tolerance

    // Bottom mobile tabbar is visible on mobile
    const mobileNav = page.locator('.mobile-tabbar');
    await expect(mobileNav).toBeVisible({ timeout: 10000 });

    // Verify mobile tab items
    await expect(mobileNav.getByText(/الرئيسية/i)).toBeVisible();
    await expect(mobileNav.getByText(/الجلسات/i)).toBeVisible();
    await expect(mobileNav.getByText(/الموارد/i)).toBeVisible();
    await expect(mobileNav.getByText(/المنافذ/i)).toBeVisible();
    await expect(mobileNav.getByText(/الحماية/i)).toBeVisible();
    await expect(mobileNav.getByText(/المزيد/i)).toBeVisible();
  });

  test('MOB-02: Mobile drawer opens and closes cleanly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Click "المزيد" to open the drawer
    const moreBtn = page.locator('.mobile-tabbar').getByText(/المزيد/i);
    await expect(moreBtn).toBeVisible({ timeout: 10000 });
    await moreBtn.click({ force: true });

    // Drawer appears
    const drawer = page.locator('.mobile-drawer');
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // Close button dismisses drawer
    const closeBtn = page.locator('.mobile-drawer__close');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
  });
});
