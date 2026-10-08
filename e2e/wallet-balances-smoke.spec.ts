import { expect, test } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

// Deterministic headless smoke: browser UI and host stores are real; auth,
// gateway and RPC/BFF boundaries use fixtures. No credentials or funded wallet.
for (const [chain, signer] of [
  ['near', false],
  ['near', true],
  ['ethereum', true],
] as const) {
  test(`@wallet-smoke login, reload and shared ${chain} holdings (signer ${signer})`, async ({
    page,
  }) => {
    const isNear = chain === 'near';
    const address = isNear ? 'funded.near' : '0x' + 'a'.repeat(40);
    const network = isNear ? 'near:mainnet' : 'eip155:1';
    const symbol = isNear ? 'NEAR' : 'ETH';
    const nativeAssetId = isNear ? 'near:native' : 'eip155:1/native';
    const tokenAssetId = isNear ? 'nep141:wrap.near' : 'usdc-ethereum';
    const tokenName = isNear ? 'Wrapped NEAR' : 'USD Coin';
    const decimals = isNear ? 24 : 18;
    const failures: string[] = [];
    page.on('pageerror', error => failures.push(error.message));
    await useAuthenticatedSession(page, {
      requireLogin: true,
      user: {
        id: 'smoke-user',
        providerUserId: 'smoke-provider',
        sessionId: 'smoke-session',
      },
      wallets: [
        {
          id: 'near',
          providerWalletId: 'near',
          address,
          chainType: chain,
          walletType: 'external',
          source: isNear ? 'near' : 'metamask',
          isPrimary: true,
        },
      ],
      accessToken: 'smoke-token',
      connection: {
        status: signer ? 'connected' : 'disconnected',
        restorationStatus: 'complete',
        account: signer ? address : null,
        chainId: isNear ? null : 1,
        identity: signer
          ? {
              address,
              chainType: chain,
              walletType: 'external',
              connectorId: isNear ? 'near' : 'metamask',
            }
          : null,
        isVerified: false,
        safetyStatus: null,
        isBypassed: false,
        executionState: 'operating.verificationPending',
        linkStatus: 'linked',
      },
    });
    await mockJsonApi(page, '/api/v1/assets', {
      data: [
        {
          assetId: nativeAssetId,
          symbol,
          name: symbol,
          blockchain: isNear ? 'near' : 'eth',
          decimals,
        },
        {
          assetId: tokenAssetId,
          symbol: isNear ? 'wNEAR' : 'USDC',
          name: tokenName,
          blockchain: isNear ? 'near' : 'eth',
          decimals,
          contractAddress: isNear ? 'wrap.near' : '0x' + 'b'.repeat(40),
        },
      ],
    });
    await mockJsonApi(page, '/api/v1/balances', {
      data: [
        {
          walletId: 'near',
          walletAddress: address,
          chainType: chain,
          network,
          assetId: nativeAssetId,
          symbol,
          decimals,
          balanceRaw: '25' + '0'.repeat(decimals - 1),
          balanceDecimal: '2.5',
          source: 'near_rpc',
          fetchedAt: new Date().toISOString(),
          expiresAt: '2099-01-01T00:00:00Z',
          stale: false,
        },
        {
          walletId: 'near',
          walletAddress: address,
          chainType: chain,
          network,
          assetId: tokenAssetId,
          symbol: isNear ? 'wNEAR' : 'USDC',
          decimals,
          balanceRaw: '1' + '0'.repeat(decimals),
          balanceDecimal: '1',
          source: 'near_rpc',
          fetchedAt: new Date().toISOString(),
          expiresAt: '2099-01-01T00:00:00Z',
          stale: false,
        },
      ],
      meta: { partial: false },
    });
    await mockJsonApi(page, '/api/v1/portfolio', {
      asOf: new Date().toISOString(),
      valuationCurrency: 'USD',
      totalValue: '7',
      positions: [],
      unpricedPositionCount: 0,
    });
    await mockJsonApi(page, '/api/v1/markets/snapshots', { data: [] });
    const readRequests: string[] = [];
    page.on('request', request => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/v1/balances'
      )
        readRequests.push(request.postData() ?? '');
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname === '/api/v1/portfolio'
      ) {
        expect(new URL(request.url()).searchParams.get('walletAddress')).toBe(
          address
        );
        expect(new URL(request.url()).searchParams.get('network')).toBe(
          network
        );
      }
    });
    await page.goto('/en/login?returnUrl=/en/profile');
    await page.getByLabel('Email', { exact: true }).fill('smoke@example.test');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.getByLabel('Code', { exact: true }).fill('123456');
    await page
      .getByRole('button', { name: 'Verify code', exact: true })
      .click();
    await expect(page).toHaveURL(/\/en\/profile/);
    const holdings = page.locator('.profile-shell__balances');
    await expect(holdings).toContainText(`2.5 ${symbol}`);
    await expect(page.locator('.profile-shell__balance')).toContainText(
      '$7.00'
    );
    await expect(page.locator('.profile-shell__wallet-badge')).toContainText(
      signer ? 'Connected' : 'Signing disconnected'
    );
    await page.reload();
    await expect(holdings).toContainText(`2.5 ${symbol}`);
    await expect(page.locator('.profile-shell__balance')).toContainText(
      '$7.00'
    );
    const beforeNavigation = readRequests.length;
    await page
      .locator('app-sidebar')
      .getByRole('link', { name: /Trade/i })
      .click();
    await expect(page.locator('.swapRow.first')).toContainText(
      isNear ? /Balance: 2[,.]5 NEAR/ : /Balance: 1 USDC/
    );
    await page.locator('.swapRow.first .select').click();
    const yourTokens = page.getByRole('listbox', {
      name: 'Tokens in connected wallet',
    });
    await expect(yourTokens).toContainText(new RegExp(`2[,.]5 ${symbol}`));
    await expect(yourTokens).toContainText(tokenName);
    expect(readRequests.length).toBe(beforeNavigation);
    await page.reload();
    await expect(page.locator('.swapRow.first')).toContainText(
      isNear ? /Balance: 2[,.]5 NEAR/ : /Balance: 1 USDC/
    );
    await page
      .locator('app-sidebar')
      .getByRole('link', { name: 'Profile', exact: true })
      .click();
    await expect(holdings).toContainText(`2.5 ${symbol}`);
    await expect(page.locator('.profile-shell__balance')).toContainText(
      '$7.00'
    );
    expect(
      readRequests.every(body => JSON.parse(body).walletAddress === address)
    ).toBe(true);
    expect(failures).toEqual([]);
  });
}
