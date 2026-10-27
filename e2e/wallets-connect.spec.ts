import { expect, test, type Page } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

const ethAddress = '0x0d07aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaad1d2';

async function useEmptyWalletSession(page: Page): Promise<void> {
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
}

async function useConnectedWalletSession(page: Page): Promise<void> {
  await useAuthenticatedSession(page, {
    requireLogin: true,
    user: {
      id: 'e2e-user',
      providerUserId: 'e2e-provider-user',
      sessionId: 'e2e-session',
      email: 'e2e-connected@craftscript.test',
    },
    wallets: [
      {
        id: 'wallet-eth',
        providerWalletId: 'provider-eth',
        address: ethAddress,
        chainType: 'ethereum',
        walletType: 'embedded',
        isPrimary: true,
      },
    ],
    accessToken: 'e2e-access-token',
    connection: {
      status: 'connected',
      restorationStatus: 'complete',
      account: ethAddress,
      chainId: 1,
      isVerified: true,
      safetyStatus: 'safe',
      isBypassed: false,
      executionState: 'operating.idle',
      linkStatus: 'linked',
      identity: {
        address: ethAddress,
        chainType: 'ethereum',
        walletType: 'embedded',
        connectorId: 'privy',
      },
    },
  });
  await mockJsonApi(page, '/api/v1/balances', { data: [] });
  await mockJsonApi(page, '/api/v1/assets', { data: [] });
  await mockJsonApi(page, '/api/v1/portfolio', {
    totalValue: '10.39',
    positions: [],
    unpricedPositionCount: 0,
  });
}

async function loginToProfile(page: Page, email: string): Promise<void> {
  await page.goto('/en/login?returnUrl=/en/profile');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByLabel('Code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify code', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/profile/);
}

test.describe('Wallets MFE connect dialog', () => {
  test('opens from the header wallets control, keeps Jupiter soon-state, and closes on outside click', async ({
    page,
  }) => {
    await useEmptyWalletSession(page);
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
    // Drawer owns scrolling for the picker — click via DOM so a clipped
    // soon-state cell still exercises the disabled Jupiter path.
    await jupiter.evaluate(node => {
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
      if (node instanceof HTMLElement) {
        node.click();
      }
    });
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
    await useEmptyWalletSession(page);
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

  test('opens connect mode from profile Connect another while a wallet is connected', async ({
    page,
  }) => {
    await useConnectedWalletSession(page);
    await loginToProfile(page, 'e2e-connected@craftscript.test');

    const wallets = page.locator('.profile-shell__panel--wallets');
    await expect(wallets).toBeVisible();
    await expect(wallets.locator('.profile-shell__wallet-row')).toHaveCount(1);

    // Header Wallets defaults to wallet mode (balances board) when connected —
    // profile Connect another is the connect-mode entry for that state.
    await expect(
      page
        .locator('header')
        .getByRole('button', { name: 'Wallets', exact: true })
    ).toBeVisible();

    const connectAnother = wallets.locator(
      '.profile-shell__connect-another-header'
    );
    await expect(connectAnother).toBeVisible();
    await connectAnother.evaluate(node => {
      node.scrollIntoView({ block: 'center' });
      if (node instanceof HTMLElement) {
        node.click();
      }
    });

    const dialog = page.locator('.side-modal.open');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Connect', exact: true })
    ).toBeVisible();

    await page.locator('.side-modal-backdrop.open').click({
      position: { x: 24, y: 360 },
    });
    await expect(page.locator('.side-modal.open')).toHaveCount(0);
  });
});
