import { test, expect } from '@playwright/test';

test.describe('ZIMAM - Mobile Responsiveness & Containment', () => {
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
    await expect(mobileNav.getByText(/الحاكم/i)).toBeVisible();
    await expect(mobileNav.getByText(/الأمان/i)).toBeVisible();
    await expect(mobileNav.getByText(/المنافذ/i)).toBeVisible();
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
