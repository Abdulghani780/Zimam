import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const screenshotDir = path.resolve('..', 'docs', 'visual-audit-screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
});

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
  { name: '13_Stitch_Gallery', path: '/gallery' },
];

test.describe('ASAAS - Visual & Layout Cohesion Audit', () => {
  for (const pageItem of pagesToAudit) {
    test(`Visual Audit: ${pageItem.name}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(pageItem.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);

      // Check no horizontal scrollbar overflow on body/html
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow, `Horizontal overflow detected on ${pageItem.name}`).toBe(false);

      // Take full page screenshot
      const shotPath = path.join(screenshotDir, `${pageItem.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      // Check broken images
      const brokenImages = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs.filter((img) => img.naturalWidth === 0 && img.style.display !== 'none').map((img) => img.src);
      });
      expect(brokenImages.length, `Broken images found on ${pageItem.name}: ${brokenImages.join(', ')}`).toBe(0);
    });
  }

  test('Visual Audit: Modals and Drawers', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // 1. AI Diag Modal
    const aiDiagBtn = page.getByRole('button', { name: /رادار الذكاء الاصطناعي/ });
    if (await aiDiagBtn.isVisible()) {
      await aiDiagBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotDir, 'Modal_Ai_Diag.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 2. Broadcast Modal
    const broadcastBtn = page.getByRole('button', { name: /تنبيه/ });
    if (await broadcastBtn.isVisible()) {
      await broadcastBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotDir, 'Modal_Broadcast.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 3. User Account Switcher
    const userAccountBtn = page.locator('header').getByRole('button', { name: /Administrator|مدير النظام/ });
    if (await userAccountBtn.isVisible()) {
      await userAccountBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotDir, 'Modal_User_Account.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 4. Session Drawer
    const sessionDetailsBtn = page.locator('table').getByRole('button', { name: /تفاصيل الجلسة/ }).first();
    if (await sessionDetailsBtn.isVisible()) {
      await sessionDetailsBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotDir, 'Drawer_Session_Details.png') });
    }
  });
});
