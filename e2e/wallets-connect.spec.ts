import { expect, test } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

test.describe('Wallets MFE connect dialog', () => {
  test.beforeEach(async ({ page }) => {
    // Empty linked wallets so header open stays on the Connect picker instead of
    // the connected-wallet board (drawerMode defaults to "wallet").
    await useAuthenticatedSession(page, {
      user: {
        id: 'e2e-user',
        providerUserId: 'e2e-provider-user',
        sessionId: 'e2e-session',
        email: 'e2e@craftscript.test',
      },
      wallets: [],
      accessToken: 'e2e-access-token',
    });
    await mockJsonApi(page, '/api/v1/balances', { data: [] });
  });

  test('opens from the header wallets control, keeps Jupiter soon-state, and closes on outside click', async ({
    page,
  }) => {
    await page.goto('/en/profile');

    await page
      .locator('header')
      .getByRole('button', { name: 'Wallets', exact: true })
      .click();

    const dialog = page.locator('.side-modal.open');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Connect', exact: true })
    ).toBeVisible();

    const jupiter = dialog.getByRole('button', { name: /Jupiter/i });
    await expect(jupiter).toBeVisible();
    // Drawer owns scrolling for the picker — bring the lower grid cell into view.
    await jupiter.evaluate(node => {
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
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
    await page
      .locator('header')
      .getByRole('button', { name: 'Wallets', exact: true })
      .click();

    const dialog = page.locator('.side-modal.open');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Connect', exact: true })
    ).toBeVisible();

    // Inject tall content into the wallets host so the assertion does not depend
    // on how many providers the remote currently renders.
    await dialog.evaluate(el => {
      const host =
        el.querySelector('.wallets-host') ??
        el.querySelector('.wallet-bar__mfe-host');
      if (!(host instanceof HTMLElement)) {
        throw new Error('wallets host not found');
      }
      const probe = document.createElement('div');
      probe.dataset.scrollProbe = 'true';
      probe.style.height = '1200px';
      host.appendChild(probe);
    });

    const metrics = await dialog.evaluate(el => {
      const mfeHost = el.querySelector('.wallet-bar__mfe-host');
      const walletsHost = el.querySelector('.wallets-host');
      return {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        overflowY: getComputedStyle(el).overflowY,
        containScroll: el.classList.contains('side-modal--contain-scroll'),
        swapReviewHost: Boolean(
          el.querySelector('.wallet-bar__mfe-host--swap-review')
        ),
        mfeHostOverflowY: mfeHost ? getComputedStyle(mfeHost).overflowY : null,
        walletsHostOverflowY: walletsHost
          ? getComputedStyle(walletsHost).overflowY
          : null,
      };
    });

    expect(metrics.containScroll).toBe(false);
    expect(metrics.swapReviewHost).toBe(false);
    expect(metrics.overflowY).toMatch(/auto|scroll/);
    expect(metrics.mfeHostOverflowY).not.toBe('hidden');
    expect(metrics.walletsHostOverflowY).not.toBe('hidden');
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    const probe = dialog.locator('[data-scroll-probe="true"]');
    await probe.evaluate(node => {
      node.scrollIntoView({ block: 'end' });
    });
    await expect(probe).toBeInViewport();
  });
});
