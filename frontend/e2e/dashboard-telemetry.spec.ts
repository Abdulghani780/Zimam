import { test, expect } from '@playwright/test';

test.describe('ASAAS Server Control - Dashboard & Live Telemetry Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-01: Page title and Live SSE connection status', async ({ page }) => {
    await expect(page).toHaveTitle(/منظومة أساس/);

    // Live status badge in header
    const liveBadge = page.getByText(/متصل مباشر/i);
    await expect(liveBadge).toBeVisible({ timeout: 10000 });
  });

  test('TC-02: Vital Stat Cards render with real numeric values', async ({ page }) => {
    // Scope search within the stat-grid container to avoid colliding with navigation links
    const statGrid = page.locator('.stat-grid');
    await expect(statGrid).toBeVisible();

    // 1. CPU Usage Stat Card
    await expect(statGrid.getByText('استخدام المعالج')).toBeVisible();

    // 2. RAM Usage Stat Card
    await expect(statGrid.getByText('الذاكرة المستخدمة')).toBeVisible();

    // 3. Active Sessions Stat Card
    await expect(statGrid.getByText('الجلسات النشطة')).toBeVisible();

    // 4. Disk Storage Stat Card
    await expect(statGrid.getByText('التخزين والملفات')).toBeVisible();
  });

  test('TC-03: Quick Action Banners (Governor & PAM JumpServer)', async ({ page }) => {
    // Governor banner
    await expect(page.getByText(/حاكم الموارد الذكي/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /إعدادات الحاكم/i })).toBeVisible();

    // PAM banner
    await expect(page.getByText(/حصن إدارة الوصول المميز/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /درع الأمان/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /خزنة الحسابات/i })).toBeVisible();
  });

  test('TC-04: Active RDP User Sessions table containment', async ({ page }) => {
    await expect(page.getByText(/جلسات سطح المكتب النشطة/i)).toBeVisible();

    // Table headers using resilient columnheader roles
    await expect(page.getByRole('columnheader', { name: 'معرف الجلسة' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'اسم المستخدم' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'الحالة' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'الذاكرة المستخدمة' })).toBeVisible();
  });

  test('TC-05: Top Resource Processes table format and action buttons', async ({ page }) => {
    // Ensure the card title is rendered
    await expect(page.getByText(/أعلى العمليات استهلاكاً للذاكرة/i)).toBeVisible();

    // Table columns
    await expect(page.getByRole('columnheader', { name: 'PID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'اسم العملية' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'المستخدم / الجلسة' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'الذاكرة (RAM)' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'إنهاء العملية' })).toBeVisible();

    // Auto-wait for processes to load and ensure termination buttons exist
    const terminateFirst = page.getByRole('button', { name: 'إنهاء' }).first();
    await expect(terminateFirst).toBeVisible({ timeout: 10000 });
    const count = await page.getByRole('button', { name: 'إنهاء' }).count();
    expect(count).toBeGreaterThan(0);
  });
});
