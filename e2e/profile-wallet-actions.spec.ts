import { expect, test, type Page } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

const ethAddress = '0x0d07aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaad1d2';

async function openProfileWithWallets(page: Page): Promise<void> {
  await useAuthenticatedSession(page, {
    requireLogin: true,
    user: {
      id: 'wallet-user',
      providerUserId: 'provider',
      sessionId: 'session',
      email: 'profile-wallets@craftscript.test',
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
      {
        id: 'wallet-near',
        providerWalletId: 'provider-near',
        address: 'mariia.near',
        chainType: 'near',
        walletType: 'external',
        isPrimary: false,
      },
    ],
    accessToken: 'e2e-token',
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
  await mockJsonApi(page, '/api/v1/assets', { data: [] });
  await mockJsonApi(page, '/api/v1/portfolio', {
    totalValue: '10.39',
    positions: [],
    unpricedPositionCount: 0,
  });
  await mockJsonApi(page, '/api/v1/balances', {
    data: [],
    meta: { partial: false },
  });

  await page.goto('/en/login?returnUrl=/en/profile');
  await page
    .getByLabel('Email', { exact: true })
    .fill('profile-wallets@craftscript.test');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByLabel('Code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify code', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/profile/);
}

async function screenshotWalletsPanel(
  page: Page,
  path: string,
  maxHeight?: number
): Promise<void> {
  await page.evaluate(() => {
    document
      .querySelector('.profile-shell__panel--wallets')
      ?.scrollIntoView({ block: 'center' });
  });
  const clip = await page.evaluate(limit => {
    const el = document.querySelector('.profile-shell__panel--wallets');
    if (!(el instanceof HTMLElement)) {
      return null;
    }
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, rect.x),
      y: Math.max(0, rect.y),
      width: rect.width,
      height:
        typeof limit === 'number'
          ? Math.min(rect.height, limit - Math.max(0, rect.y))
          : rect.height,
    };
  }, maxHeight);
  if (clip && clip.width > 0 && clip.height > 0) {
    await page.screenshot({ path, clip });
  }
}

test('desktop profile wallets match compact address and action layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openProfileWithWallets(page);

  const wallets = page.locator('.profile-shell__panel--wallets');
  await expect(wallets).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Manage wallets' })
  ).toHaveCount(0);

  const rows = wallets.locator('.profile-shell__wallet-row');
  await expect(rows).toHaveCount(2);

  const primary = rows.nth(0);
  await expect(
    primary.getByRole('button', { name: 'Copy address' })
  ).toBeVisible();
  await expect(primary.locator('.profile-shell__wallet-badge')).toContainText(
    'Active · Connected'
  );
  await expect(
    wallets.getByRole('button', { name: 'Connect another', exact: true })
  ).toBeVisible();
  await expect(
    primary.getByRole('button', { name: 'Disconnect' })
  ).toBeVisible();
  await expect(
    primary.getByRole('button', { name: 'Make active' })
  ).toHaveCount(0);
  await expect(primary.getByRole('button', { name: 'Remove' })).toHaveCount(0);

  const secondary = rows.nth(1);
  await expect(
    secondary.getByRole('button', { name: 'Copy address' })
  ).toBeVisible();
  await expect(
    secondary.getByRole('button', { name: 'Make active' })
  ).toBeVisible();
  await expect(secondary.getByRole('button', { name: 'Remove' })).toBeVisible();
  await expect(
    secondary.getByRole('button', { name: 'Disconnect' })
  ).toHaveCount(0);

  await screenshotWalletsPanel(
    page,
    'tmp/screenshots/profile-wallets-desktop.png',
    800
  );
});

test('mobile profile wallets stack status and actions under details', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfileWithWallets(page);

  const wallets = page.locator('.profile-shell__panel--wallets');
  await expect(wallets).toBeVisible();
  await expect(
    wallets.getByRole('button', { name: 'Connect another', exact: true })
  ).toBeVisible();

  const primary = wallets.locator('.profile-shell__wallet-row').nth(0);
  await expect(
    primary.getByRole('button', { name: 'Copy address' })
  ).toBeVisible();
  await expect(
    primary.getByRole('button', { name: 'Disconnect' })
  ).toBeVisible();

  const stacked = await page.evaluate(() => {
    document
      .querySelector('.profile-shell__panel--wallets')
      ?.scrollIntoView({ block: 'center' });
    const row = document.querySelector('.profile-shell__wallet-row');
    const address = row?.querySelector('.profile-shell__wallet-address-row');
    const side = row?.querySelector('.profile-shell__wallet-side');
    if (!(address instanceof HTMLElement) || !(side instanceof HTMLElement)) {
      return null;
    }
    const addressRect = address.getBoundingClientRect();
    const sideRect = side.getBoundingClientRect();
    return sideRect.y > addressRect.y + addressRect.height - 4;
  });
  expect(stacked).toBe(true);

  await screenshotWalletsPanel(
    page,
    'tmp/screenshots/profile-wallets-mobile.png'
  );
});
