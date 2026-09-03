import { expect, test } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

test.describe('Wallets MFE connect dialog', () => {
  test.beforeEach(async ({ page }) => {
    await useAuthenticatedSession(page);
    await mockJsonApi(page, '/api/v1/balances', { data: [] });
  });

  test('opens from Connect another wallet, keeps Jupiter soon-state, and closes on outside click', async ({
    page,
  }) => {
    await page.goto('/en/profile');

    await page.getByRole('button', { name: 'Connect another wallet' }).click();

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
});
