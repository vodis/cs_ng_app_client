import { expect, test } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

for (const width of [390, 1280]) {
  test(`token totals and funding network selection at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    };
    const wallets = [
      {
        id: 'near',
        providerWalletId: 'near',
        address: 'alice.near',
        chainType: 'near',
        walletType: 'external',
        isPrimary: true,
      },
      {
        id: 'eth',
        providerWalletId: 'eth',
        address: '0x' + 'a'.repeat(40),
        chainType: 'ethereum',
        walletType: 'external',
        isPrimary: false,
      },
    ];
    const assets = [
      {
        assetId: 'nep141:eth.near',
        symbol: 'ETH',
        name: 'Ethereum',
        blockchain: 'near',
        sourceNetwork: 'near:mainnet',
        decimals: 18,
        contractAddress: 'eth.near',
      },
      {
        assetId: 'eip155:1/native',
        symbol: 'ETH',
        name: 'Ethereum',
        blockchain: 'eth',
        sourceNetwork: 'eip155:1',
        balanceAssetId: 'eip155:1/native',
        decimals: 18,
      },
      {
        assetId: 'nep141:usdc.near',
        symbol: 'USDC',
        name: 'USD Coin',
        blockchain: 'near',
        sourceNetwork: 'near:mainnet',
        decimals: 6,
        contractAddress: 'usdc.near',
      },
    ];
    await useAuthenticatedSession(page, {
      user: { id: 'user', providerUserId: 'provider', sessionId: 'session' },
      wallets,
      accessToken: 'test',
    });
    await mockJsonApi(page, '/api/v1/assets', { data: assets });
    await mockJsonApi(page, '/api/v1/markets/snapshots', { data: [] });
    await mockJsonApi(page, '/api/v1/swaps/history', { data: [], meta: {} });
    await page.route('**/api/v1/balances', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      const request: {
        walletAddress: string;
        network: string;
        assetIds?: string[];
      } = route.request().postDataJSON();
      const wallet = wallets.find(
        item => item.address === request.walletAddress
      );
      const tokens = assets.filter(
        asset =>
          asset.sourceNetwork === request.network &&
          (!request.assetIds || request.assetIds.includes(asset.assetId))
      );
      await route.fulfill({
        headers,
        json: {
          data: tokens.map(token => ({
            walletId: wallet?.id,
            walletAddress: request.walletAddress,
            chainType: wallet?.chainType,
            network: request.network,
            assetId: token.assetId,
            symbol: token.symbol,
            decimals: token.decimals,
            balanceRaw: '1' + '0'.repeat(token.decimals),
            balanceDecimal: '1',
            source: 'rpc',
            fetchedAt: new Date().toISOString(),
            expiresAt: '2099-01-01T00:00:00Z',
            stale: false,
          })),
          meta: { partial: false },
        },
      });
    });
    let primaryCalls = 0;
    await page.route('**/api/v1/wallets/eth/primary', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      primaryCalls++;
      wallets[0].isPrimary = false;
      wallets[1].isPrimary = true;
      await mockJsonApi(page, '/api/v1/wallets', { wallets });
      await route.fulfill({ headers, json: { wallet: wallets[1] } });
    });
    await page.goto('/en');
    await expect(page.locator('.swapRow.first')).toContainText('Balance:');
    await page.locator('.swapRow.first .select').click();
    const picker = page.locator('app-token-select-panel');
    const eth = picker.getByRole('button', { name: /^ETH / });
    await expect(eth).toHaveCount(1);
    await expect(
      eth.locator('.token-select-panel__wallet-balance strong')
    ).toHaveText('2');
    await eth.click();
    await expect(picker).toContainText('ETH_NEAR');
    await expect(picker).toContainText('ETH_Ethereum');
    await expect(
      picker.getByRole('button', { name: /alice.near/ })
    ).toContainText('1');
    await picker.getByRole('button', { name: /0xaaaa/ }).click();
    await expect(page.locator('app-side-modal .side-modal.open')).toHaveCount(
      0
    );
    await expect(page.locator('.swapRow.first')).toContainText('ETH');
    await expect.poll(() => primaryCalls).toBe(1);
    await page.locator('.swapRow:not(.first) .select').click();
    await picker.getByRole('button', { name: /^ETH / }).click();
    await expect(picker).toContainText('ETH_NEAR');
    await expect(picker).not.toContainText('ETH_Ethereum');
    await picker.getByRole('button', { name: /ETH_NEAR/ }).click();
    expect(primaryCalls).toBe(1);
  });
}
