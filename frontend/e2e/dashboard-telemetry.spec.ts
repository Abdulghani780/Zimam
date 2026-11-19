import { test, expect } from '@playwright/test';

const USER = process.env.E2E_USER || 'e2e-admin';
const PASS = process.env.E2E_PASS || '';

test.describe('ASAAS - Dashboard & Live Telemetry Journeys', () => {
  test.skip(!PASS, 'E2E_PASS not set');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[autocomplete="username"]').fill(USER);
    await page.locator('input[autocomplete="current-password"]').fill(PASS);
    await page.getByRole('button', { name: /دخول إلى لوحة التحكم/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-01: Page title and connection status pill', async ({ page }) => {
    await expect(page).toHaveTitle(/زمام/);

    // Connection pill in header shows live/disconnected state
    const connPill = page.locator('.conn-pill');
    await expect(connPill).toBeVisible({ timeout: 10000 });
    await expect(connPill).toContainText(/متصل|غير متصل/);
  });

  test('TC-02: KPI cards render with real metric labels', async ({ page }) => {
    const kpiGrid = page.locator('.kpi-grid');
    await expect(kpiGrid).toBeVisible();

    await expect(kpiGrid.getByText('المعالج (CPU)')).toBeVisible();
    await expect(kpiGrid.getByText('الذاكرة (RAM)')).toBeVisible();
    await expect(kpiGrid.getByText('القرص (C:)')).toBeVisible();
    await expect(kpiGrid.getByText('الشبكة')).toBeVisible();
    await expect(kpiGrid.getByText('جلسات RDP النشطة')).toBeVisible();
    await expect(kpiGrid.getByText('التنبيهات الأمنية')).toBeVisible();
  });

  test('TC-03: Server status panels render', async ({ page }) => {
    // Fleet panel is conditional on control-plane /api/v1 availability —
    // assert only the always-rendered host panels.
    await expect(page.getByText(/حالة السيرفر/).first()).toBeVisible();
    await expect(page.getByText(/السيرفرات والخدمات/).first()).toBeVisible();
    await expect(page.getByText(/النشاط الأخير/)).toBeVisible();
  });

  test('TC-04: Servers & services table renders with real columns', async ({ page }) => {
    await expect(page.getByText('السيرفرات والخدمات').first()).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'اسم السيرفر / الخدمة' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'الحالة' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'المعالج' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'الذاكرة' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'القرص' })).toBeVisible();
  });

  test('TC-05: Recent activity feed renders audit entries', async ({ page }) => {
    const activity = page.locator('.activity-card');
    await expect(activity).toBeVisible();
    await expect(activity.getByText(/النشاط الأخير/)).toBeVisible();
    await expect(activity.getByText(/لا توجد أحداث تدقيق حديثة|عرض جميع السجلات/).first()).toBeVisible({ timeout: 10000 });
  });
});
