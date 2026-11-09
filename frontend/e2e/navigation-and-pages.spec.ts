import { test, expect } from '@playwright/test';

test.describe('ASAAS Server Control - Navigation & Core Pages Journeys', () => {
  test('NAV-01: Navigate to Resource Governor (/control)', async ({ page }) => {
    await page.goto('/control');
    await expect(page).toHaveURL(/.*control/);

    // Verify main headings
    await expect(page.getByText(/مركز التحكم وحاكم الموارد الذكي/i)).toBeVisible();
    await expect(page.getByText(/مصفوفة المستهلكين الأثقل/i)).toBeVisible();
    await expect(page.getByText(/سياسات الحاكم التلقائي/i)).toBeVisible();
  });

  test('NAV-02: Navigate to Ports & Sockets Radar (/ports)', async ({ page }) => {
    await page.goto('/ports');
    await expect(page).toHaveURL(/.*ports/);

    await expect(page.getByText(/درع الذكاء الاصطناعي لعزل المنافذ/i)).toBeVisible();
    await expect(page.getByText(/كاشف المنافذ والاتصالات والخدمات/i)).toBeVisible();
  });

  test('NAV-03: Navigate to Windows Local Users Directory (/users)', async ({ page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL(/.*users/);

    await expect(page.getByText(/حوكمة مستخدمي ويندوز المحليين/i)).toBeVisible();
    await expect(page.getByText(/دليل حسابات السيرفر المحلي/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /إضافة مستخدم جديد/i })).toBeVisible();
  });

  test('NAV-04: Navigate to Storage & Lockout Radar (/storage)', async ({ page }) => {
    await page.goto('/storage');
    await expect(page).toHaveURL(/.*storage/);

    await expect(page.getByText(/إدارة سعة التخزين وتطهير السيرفر/i)).toBeVisible();
  });

  test('NAV-05: Navigate to Audit & Compliance (/audit)', async ({ page }) => {
    await page.goto('/audit');
    await expect(page).toHaveURL(/.*audit/);

    await expect(page.getByText(/سلسلة سجلات الامتثال/i)).toBeVisible();
  });

  test('NAV-06: Navigate to Security & Defense Shield (/security)', async ({ page }) => {
    await page.goto('/security');
    await expect(page).toHaveURL(/.*security/);

    await expect(page.getByText(/مصفوفة الدفاع السيبراني ورادار الاختراق/i)).toBeVisible();
  });
});
