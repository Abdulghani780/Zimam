import { expect, test, type Page } from '@playwright/test';

const USER = process.env.E2E_USER || 'e2e-admin';
const PASS = process.env.E2E_PASS || '';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill(USER);
  await page.locator('input[autocomplete="current-password"]').fill(PASS);
  await page.getByRole('button', { name: /دخول إلى لوحة التحكم/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  await expect(page.locator('h1').first()).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect(page.locator('body')).toHaveCSS('font-family', /Thmanyah/);
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  )).toBe(false);
}

test.describe('ASAAS workspace shell', () => {
  test.skip(!PASS, 'E2E_PASS not set — skipping authenticated workspace tests');

  test('groups every destination and does not invent notification counts', async ({ page }) => {
    await login(page);
    await expect(page.locator('.sidebar-nav__group')).toHaveCount(4);
    await expect(page.locator('.sidebar-nav .sidebar-link')).toHaveCount(21);
    await expect(page.locator('.header-icon-btn__badge')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'بث تنبيه إداري' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('phone drawer shows the signed-in user, traps focus, closes and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    const menu = page.getByRole('button', { name: 'المزيد من القوائم' });
    await menu.click();
    const drawer = page.getByRole('dialog', { name: 'قائمة التنقل الموسعة' });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.mobile-drawer__identity strong')).not.toHaveText('Administrator');
    const close = page.getByRole('button', { name: 'إغلاق القائمة' });
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(drawer.locator('a').last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();
    await menu.click();
    await drawer.locator('a[href="/ports"]').click();
    await page.waitForURL('**/ports');
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('a transient lazy-chunk failure reloads once and recovers', async ({ page }) => {
    await login(page);
    let failedOnce = false;
    await page.route('**/assets/ControlPage-*.js', (route) => {
      if (!failedOnce) {
        failedOnce = true;
        return route.abort('failed');
      }
      return route.continue();
    });
    await page.goto('/control');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('تعذر عرض هذه الصفحة')).toHaveCount(0);
    expect(failedOnce).toBe(true);
  });

  test('all navigation destinations render without runtime exceptions', async ({ page }) => {
    const errors: string[] = [];
    let currentPath = '/';
    page.on('pageerror', (error) => errors.push(`${currentPath}: ${error.message}`));
    await login(page);
    const paths = [
      '/servers', '/agents', '/control', '/governor', '/infrastructure',
      '/development', '/containers', '/databases', '/network-storage', '/storage',
      '/ports', '/bastion', '/assets', '/vault', '/users', '/jit', '/replay',
      '/security', '/audit', '/settings',
    ];
    for (const path of paths) {
      currentPath = path;
      await page.locator(`.sidebar-nav a[href="${path}"]`).click();
      await page.waitForURL(`**${path}`);
      await expect(page.locator('h1').first(), `${currentPath} should render a heading`).toBeVisible({ timeout: 15000 });
    }
    expect(errors).toEqual([]);
  });

  test('assistant does not claim health when live diagnostics fail', async ({ page }) => {
    await page.route('**/api/ai/diagnose', (route) => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'diagnostics unavailable' }),
    }));
    await login(page);
    await page.locator('.assistant-launcher').click();
    await page.locator('.composer__input').fill('هل النظام سليم؟');
    await page.locator('.composer__send').click();
    await expect(page.locator('.assistant-panel')).toContainText(
      'لم يتم تأكيد حالة المنظومة',
    );
  });

  test('theme and language switches preserve a responsive workspace', async ({ page }) => {
    await login(page);
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');
    await page.getByRole('button', { name: 'إعدادات سريعة' }).click();
    await page.getByRole('menuitem', { name: /الوضع (النهاري|الليلي)/ }).click();
    await expect(html).not.toHaveAttribute('data-theme', initialTheme ?? '');

    await page.getByRole('button', { name: 'إعدادات سريعة' }).click();
    await page.getByRole('menuitem', { name: 'English', exact: true }).click();
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('h1').first()).toHaveText('Command dashboard');
    await expect(page).toHaveTitle(/Command dashboard · Zimam/);

    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('h1').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
});
