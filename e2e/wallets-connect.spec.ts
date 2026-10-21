import { expect, test } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

test.describe('Wallets MFE connect dialog', () => {
  test.beforeEach(async ({ page }) => {
    await useAuthenticatedSession(page);
    await mockJsonApi(page, '/api/v1/balances', { data: [] });
  });

  test('opens from Manage wallets, keeps Jupiter soon-state, and closes on outside click', async ({
    page,
  }) => {
    await page.goto('/en/profile');

    await page.getByRole('button', { name: 'Manage wallets' }).click();

    const dialog = page.locator('.side-modal.open');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Connect', exact: true })
    ).toBeVisible();

    const jupiter = dialog.getByRole('button', { name: /Jupiter/i });
    await expect(jupiter).toBeVisible();
    await jupiter.click({ force: true });
    await expect(
      dialog.getByRole('heading', { name: 'Connect', exact: true })
    ).toBeVisible();

    await page.locator('.side-modal-backdrop.open').click({
      position: { x: 24, y: 360 },
    });

    await expect(page.locator('.side-modal.open')).toHaveCount(0);
    await expect(
      page
        .locator('.side-modal')
        .getByRole('heading', { name: 'Connect', exact: true })
    ).toBeHidden();
  });

  test('keeps the wallet picker scrollable on a short viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await page.goto('/en/profile');
    await page.getByRole('button', { name: 'Manage wallets' }).click();

    const dialog = page.locator('.side-modal.open');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Connect', exact: true })
    ).toBeVisible();

    const metrics = await dialog.evaluate(el => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowY: getComputedStyle(el).overflowY,
      containScroll: el.classList.contains('side-modal--contain-scroll'),
    }));

    expect(metrics.containScroll).toBe(false);
    expect(metrics.overflowY).toMatch(/auto|scroll/);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  });
});
