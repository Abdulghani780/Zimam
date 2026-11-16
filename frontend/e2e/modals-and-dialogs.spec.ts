import { test, expect } from '@playwright/test';

test.describe('ZIMAM - Modals & Interactive Dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('MD-01: AI Ops Radar Diagnostic Modal lifecycle', async ({ page }) => {
    // 1. Open AI Ops Radar modal from header
    const aiDiagBtn = page.getByRole('button', { name: /رادار الذكاء الاصطناعي/i });
    await expect(aiDiagBtn).toBeVisible({ timeout: 10000 });
    await aiDiagBtn.click();

    // 2. Dialog appears and is centered
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/تقرير التشخيص الذكي لخوادم زِمام/i)).toBeVisible();

    // 3. Vital signals inside dialog
    await expect(dialog.getByText(/المعالج والأنوية/i)).toBeVisible();
    await expect(dialog.getByText(/حاكم الذاكرة/i)).toBeVisible();
    await expect(dialog.getByText(/الأقراص والتخزين/i)).toBeVisible();

    // 4. Close dialog via primary close button
    const closeBtn = dialog.getByRole('button', { name: /إغلاق التقرير/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // 5. Verify dialog is dismissed
    await expect(dialog).not.toBeVisible();
  });

  test('MD-02: Broadcast Notification Modal lifecycle and form inputs', async ({ page }) => {
    // 1. Click "تنبيه" in the header
    const alertBtn = page.getByRole('button', { name: /تنبيه/i });
    await expect(alertBtn).toBeVisible({ timeout: 10000 });
    await alertBtn.click({ force: true });

    // 2. Verify Broadcast modal appears
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/بث تنبيه فوري لجميع المستخدمين/i)).toBeVisible();

    // 3. Check inputs
    const titleInput = dialog.getByLabel(/عنوان التنبيه/i);
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue('إشعار رسمي من إدارة السيرفر');

    const msgInput = dialog.getByLabel(/نص الرسالة/i);
    await expect(msgInput).toBeVisible();

    // Type a test message
    await msgInput.fill('اختبار تجريبي لفحص جاهزية التنبيهات');
    await expect(msgInput).toHaveValue('اختبار تجريبي لفحص جاهزية التنبيهات');

    // 4. Cancel and close
    const cancelBtn = dialog.getByRole('button', { name: /إلغاء/i });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await expect(dialog).not.toBeVisible();
  });

  test('MD-03: User Account & Role Switcher Modal lifecycle', async ({ page }) => {
    // 1. Click user pill in header
    const userBtn = page.getByRole('button', { name: /تغيير المستخدم والدور/i });
    await expect(userBtn).toBeVisible({ timeout: 10000 });
    await userBtn.click({ force: true });

    // 2. Dialog appears
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/إدارة الحسابات وصلاحيات الوصول/i)).toBeVisible();

    // 3. Close modal via close button
    const closeIcon = dialog.getByRole('button', { name: /إغلاق النافذة/i });
    await expect(closeIcon).toBeVisible();
    await closeIcon.click();
    await expect(dialog).not.toBeVisible();
  });
});
