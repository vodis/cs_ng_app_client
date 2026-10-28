import { expect, test, type Page, type Route } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

const walletId = '11111111-1111-4111-8111-111111111111';
const recipient = '0x1111111111111111111111111111111111111111';
const address = '0x2222222222222222222222222222222222222222';
const assetId = 'usdc-base';
const endpoint = '**/api/v1/deposits/instructions';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function instructions(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      walletId,
      recipient,
      assetId,
      network: 'eip155:8453',
      amount: '1.25',
      minimumReceived: '1.2',
      address,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ...overrides,
    },
  };
}

async function respond(route: Route, body: unknown, status = 201) {
  await route.fulfill({
    status,
    headers,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockDeposit(
  page: Page,
  handle: (route: Route) => Promise<void>
) {
  await page.route(endpoint, async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await handle(route);
  });
}

async function openDeposit(page: Page) {
  await useAuthenticatedSession(page, {
    user: {
      id: 'deposit-user',
      providerUserId: 'provider',
      sessionId: 'session',
    },
    wallets: [
      {
        id: walletId,
        providerWalletId: walletId,
        address: recipient,
        chainType: 'ethereum',
        walletType: 'embedded',
        status: 'active',
        isPrimary: true,
      },
    ],
    accessToken: 'deposit-test-token',
  });
  await mockJsonApi(page, '/api/v1/assets', {
    data: [
      {
        assetId,
        symbol: 'USDC',
        name: 'USD Coin',
        blockchain: 'base',
        decimals: 6,
        sourceNetwork: 'eip155:8453',
      },
      {
        assetId: 'usdc-eth',
        symbol: 'USDC',
        name: 'USD Coin',
        blockchain: 'eth',
        decimals: 6,
        sourceNetwork: 'eip155:1',
      },
    ],
  });
  await mockJsonApi(page, '/api/v1/portfolio', {
    totalValue: '0',
    positions: [],
    unpricedPositionCount: 0,
  });
  await mockJsonApi(page, '/api/v1/balances', {
    data: [],
    meta: { partial: false },
  });
  await page.goto('/en/profile');
  await page.getByRole('button', { name: 'Add Funds', exact: true }).click();
  const panel = page.locator('app-add-funds-panel');
  await panel.getByRole('button', { name: /USDC.*2 networks/ }).click();
  await panel
    .getByRole('list', { name: 'Networks' })
    .getByRole('button', { name: /base/i })
    .click();
  await panel.getByLabel('Amount to send (USDC)').fill('1.25');
  return panel;
}

test('selects token/network and amount, renders the quoted QR, and copies its address', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let calls = 0;
  await mockDeposit(page, async route => {
    calls++;
    expect(route.request().headers()['authorization']).toBe(
      'Bearer deposit-test-token'
    );
    expect(route.request().postDataJSON()).toEqual({
      walletId,
      assetId,
      amount: '1.25',
    });
    await respond(route, instructions());
  });
  const panel = await openDeposit(page);
  expect(calls).toBe(0);
  await panel.getByRole('button', { name: 'Get deposit address' }).click();
  const qr = panel.getByAltText('Deposit address QR code');
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(panel).toContainText('Send exactly 1.25 USDC');
  await expect(panel).toContainText('Receive at least 1.2');
  await panel.getByRole('button', { name: 'Copy address' }).click();
  await expect(panel.getByRole('button', { name: 'Copied!' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    address
  );
  expect(calls).toBe(1);
  await panel.getByLabel('Amount to send (USDC)').fill('2');
  await expect(qr).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Copy address' })).toHaveCount(
    0
  );
});

test('discards an in-flight quote after amount edits and allows a fresh request', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let calls = 0;
  await mockDeposit(page, async route => {
    if (++calls === 1) await gate;
    await respond(route, instructions());
  });
  const panel = await openDeposit(page);
  const button = panel.getByRole('button', { name: 'Get deposit address' });
  await button.click();
  await expect(button).toBeDisabled();
  try {
    await panel.getByLabel('Amount to send (USDC)').fill('2');
    await panel.getByLabel('Amount to send (USDC)').fill('1.25');
  } finally {
    release();
  }
  await expect(button).toBeEnabled();
  await expect(panel.getByAltText('Deposit address QR code')).toHaveCount(0);
  await expect(panel.locator('.add-funds-panel__address-value')).toHaveCount(0);
  await button.click();
  await expect(panel.getByAltText('Deposit address QR code')).toBeVisible();
  expect(calls).toBe(2);
});

test('removes expired instructions and requires another request', async ({
  page,
}) => {
  await page.clock.install();
  await mockDeposit(page, route => respond(route, instructions()));
  const panel = await openDeposit(page);
  await panel.getByRole('button', { name: 'Get deposit address' }).click();
  await expect(panel.getByAltText('Deposit address QR code')).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect(panel.getByAltText('Deposit address QR code')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Copy address' })).toHaveCount(
    0
  );
  await expect(
    panel.getByRole('button', { name: 'Get deposit address' })
  ).toBeEnabled();
});

test('shows a mandatory memo without an address-only QR', async ({ page }) => {
  await mockDeposit(page, route =>
    respond(route, instructions({ memo: '12345' }))
  );
  const panel = await openDeposit(page);
  await panel.getByRole('button', { name: 'Get deposit address' }).click();
  await expect(panel.getByRole('alert')).toContainText('12345');
  await expect(
    panel.getByRole('button', { name: 'Copy address' })
  ).toBeVisible();
  await expect(panel.getByAltText('Deposit address QR code')).toHaveCount(0);
});

for (const failure of [
  'provider rejection',
  'wrong wallet',
  'wrong amount',
  'expired quote',
]) {
  test(`fails closed for ${failure}`, async ({ page }) => {
    await mockDeposit(page, route => {
      if (failure === 'provider rejection')
        return respond(route, { message: 'Unavailable' }, 502);
      const overrides =
        failure === 'wrong wallet'
          ? { walletId: 'other' }
          : failure === 'wrong amount'
            ? { amount: '2' }
            : { expiresAt: '2000-01-01T00:00:00Z' };
      return respond(route, instructions(overrides));
    });
    const panel = await openDeposit(page);
    await panel.getByRole('button', { name: 'Get deposit address' }).click();
    await expect(panel).toContainText('Deposit instructions are unavailable');
    await expect(panel.getByAltText('Deposit address QR code')).toHaveCount(0);
    await expect(
      panel.getByRole('button', { name: 'Copy address' })
    ).toHaveCount(0);
  });
}
