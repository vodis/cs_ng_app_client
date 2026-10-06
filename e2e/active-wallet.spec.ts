import { expect, test } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

test('restores the backend active wallet and loads balances without Refresh after reload', async ({
  page,
}) => {
  const address = 'active.near';
  await useAuthenticatedSession(page, {
    user: {
      id: 'wallet-user',
      providerUserId: 'provider',
      sessionId: 'session',
    },
    wallets: [
      {
        id: 'old',
        providerWalletId: 'old',
        address: 'old.near',
        chainType: 'near',
        walletType: 'external',
        isPrimary: false,
      },
      {
        id: 'active',
        providerWalletId: 'active',
        address,
        chainType: 'near',
        walletType: 'external',
        isPrimary: true,
      },
    ],
    accessToken: 'e2e-token',
    connection: {
      status: 'connected',
      account: address,
      chainId: null,
      isVerified: false,
      safetyStatus: 'safe',
      isBypassed: false,
      executionState: 'operating.verificationPending',
      linkStatus: 'linked',
      identity: {
        address,
        chainType: 'near',
        walletType: 'external',
        connectorId: 'near',
      },
    },
  });
  await mockJsonApi(page, '/api/v1/assets', { data: [] });
  await mockJsonApi(page, '/api/v1/portfolio', {
    totalValue: '0',
    positions: [],
    unpricedPositionCount: 0,
  });
  await mockJsonApi(page, '/api/v1/balances', {
    data: [
      {
        walletId: 'active',
        walletAddress: address,
        chainType: 'near',
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '2000000000000000000000000',
        balanceDecimal: '2',
        source: 'near_rpc',
        stale: false,
        fetchedAt: '2026-10-03T00:00:00Z',
        expiresAt: '2099-01-01T00:00:00Z',
      },
    ],
    meta: { partial: false },
  });
  const balanceRequests: string[] = [];
  page.on('request', request => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/balances'
    ) {
      balanceRequests.push(request.postData() ?? '');
    }
  });
  await page.goto('/en/profile');
  const balances = page.locator('.profile-shell__balances');
  await expect(balances).toContainText('NEAR');
  await expect(balances).toContainText('2');
  await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
    'Active · Connected'
  );
  expect(balanceRequests).toHaveLength(1);
  expect(JSON.parse(balanceRequests[0])).toEqual({
    walletAddress: address,
    network: 'near:mainnet',
  });

  await page.reload();
  await expect(balances).toContainText('NEAR');
  await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
    'Active · Connected'
  );
  expect(balanceRequests).toHaveLength(2);
  await page
    .getByRole('button', { name: 'Refresh', exact: true })
    .last()
    .click();
  await expect.poll(() => balanceRequests.length).toBe(3);
  await expect(balances).toContainText('NEAR');

  await page.goto('/en');
  await expect(
    page.getByRole('button', { name: 'REVIEW', exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('Verify the active wallet before signing.')
  ).toHaveCount(0);
});
