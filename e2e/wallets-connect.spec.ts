import { expect, test, type Page } from '@playwright/test';
import {
  API_BASE_URL,
  mockJsonApi,
  useAuthenticatedSession,
} from './utils/auth-fixtures';

const ethAddress = '0x0d07aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaad1d2';
const tonAddress = 'EQDtesttonaddress000000000000000000000000000';
const bitcoinAddress = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';

// Real wallet remote + mocked provider I/O. Skipped unless WALLET_MFE_TEST_URL is set.
const gatewayUrl = process.env.WALLET_MFE_TEST_URL;

async function mockApiV1Fallback(page: Page): Promise<void> {
  // Register first so later specific mocks win (Playwright matches newest first).
  await page.route(
    url =>
      url.origin === new URL(API_BASE_URL).origin &&
      url.pathname.startsWith('/api/v1/'),
    async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods':
              'GET, PUT, POST, DELETE, PATCH, OPTIONS',
          },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ data: [], wallets: [] }),
      });
    }
  );
}

async function useConnectedWalletSession(
  page: Page,
  realGatewayUrl?: string
): Promise<void> {
  // Empty-wallet + loginToProfile breaks: verify calls reloadWallets() and fails.
  // Connected session skips that path (initialWalletCount > 0) — same as the
  // stable "Connect another" test below.
  await mockApiV1Fallback(page);
  await useAuthenticatedSession(
    page,
    {
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
    },
    realGatewayUrl
  );
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
  await expect(page).toHaveURL(/\/en\/profile/, { timeout: 15_000 });
}

/** Connected accounts open the balances board from header — use Connect another. */
async function openConnectDrawer(page: Page): Promise<void> {
  await loginToProfile(page, 'e2e-connected@craftscript.test');
  const wallets = page.locator('.profile-shell__panel--wallets');
  await expect(wallets).toBeVisible();
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
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(
    dialog.getByRole('heading', { name: 'Connect', exact: true })
  ).toBeVisible({ timeout: 15_000 });
}

test.describe('Wallets MFE connect dialog', () => {
  // Hardcoded remote fixture only — buttons have no connection handlers.
  // TON/UniSat connection regression lives in the real-remote suite below.
  test('host drawer opens from Connect another, lists fixture wallets including TON and UniSat, and closes on outside click', async ({
    page,
  }) => {
    await useConnectedWalletSession(page);
    await openConnectDrawer(page);

    const dialog = page.locator('.side-modal.open');
    const phantom = dialog.getByRole('button', { name: /Phantom/i });
    const solflare = dialog.getByRole('button', { name: /Solflare/i });
    const jupiter = dialog.getByRole('button', { name: /Jupiter/i });
    const tonWallets = dialog.getByRole('button', { name: /TON Wallets/i });
    const unisat = dialog.getByRole('button', { name: /UniSat/i });
    await expect(phantom).toBeVisible();
    await expect(solflare).toBeVisible();
    await expect(jupiter).toBeVisible();
    await expect(tonWallets).toBeVisible();
    await expect(unisat).toBeVisible();
    await expect(jupiter).toBeEnabled();
    await expect(tonWallets).toBeEnabled();
    await expect(unisat).toBeEnabled();
    await expect(dialog.locator('.connect-wallet__soon')).toHaveCount(0);
    // Fixture TON cell is inert — click only proves the host drawer stays open.
    await tonWallets.evaluate(node => {
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
    await useConnectedWalletSession(page);
    await openConnectDrawer(page);

    const dialog = page.locator('.side-modal.open');
    await page.setViewportSize({ width: 390, height: 640 });

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
    await openConnectDrawer(page);

    await page.locator('.side-modal-backdrop.open').click({
      position: { x: 24, y: 360 },
    });
    await expect(page.locator('.side-modal.open')).toHaveCount(0);
  });
});

async function installVitePreamble(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.assign(window, {
      __vite_plugin_react_preamble_installed__: true,
      $RefreshReg$: () => {},
      $RefreshSig$: () => (value: unknown) => value,
    });
  });
}

async function mockAuthProviderRuntime(page: Page): Promise<void> {
  await page.route(
    '**/src/features/auth-provider/model/auth-provider.runtime.ts*',
    route =>
      route.fulfill({
        contentType: 'application/javascript',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: `
          let snapshot = { status: 'ready', embeddedWalletEnabled: true };
          const listeners = new Set();
          export const authProviderRuntime = {
            subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
            getSnapshot: () => snapshot,
            getAccessToken: async () => 'e2e-access-token',
            getWalletSession: async () => ({
              account: '${ethAddress}',
              chainId: 1,
            }),
            peekEmbeddedWallet: async () => ({
              address: '${ethAddress}',
              chainType: 'ethereum',
            }),
            bindEmbeddedWallet: async () => ({
              address: '${ethAddress}',
              chainType: 'ethereum',
            })
          };
        `,
      })
  );
}

async function mockWalletOwnershipLinkApis(page: Page): Promise<void> {
  await mockJsonApi(page, '/api/v1/wallets/link/challenge', {
    challengeId: 'e2e-challenge',
    message: 'e2e-link-message',
  });
  await mockJsonApi(page, '/api/v1/wallets/link/verify', { ok: true });
}

async function mockTonAndUnisatConnectors(page: Page): Promise<void> {
  await page.route('**/src/connectors/connector-factory.ts*', route =>
    route.fulfill({
      contentType: 'application/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: `
        const tonListeners = new Set();
        let tonPrompt = null;
        function publishTonPrompt(next) {
          tonPrompt = next;
          tonListeners.forEach(listener => listener(next));
        }

        const tonkeeper = {
          id: 'tonkeeper',
          label: 'TON Wallets',
          available: true,
          getPairingPrompt: () => tonPrompt,
          subscribeToPairingPrompt: listener => {
            tonListeners.add(listener);
            listener(tonPrompt);
            return () => tonListeners.delete(listener);
          },
          cancelPairingPrompt: () => {
            publishTonPrompt(null);
            window.dispatchEvent(new Event('e2e.ton-cancel'));
          },
          subscribeToSessionChanges: () => () => {},
          // chainId must match connect() — assertWalletSession compares both.
          getSession: async () =>
            sessionStorage.getItem('e2e.ton-connected')
              ? { account: '${tonAddress}', chainId: -239 }
              : null,
          signMessage: async () => ({ signature: 'e2e-ton-sig' }),
          connect: async () => {
            publishTonPrompt({
              title: 'Connect TON wallet',
              description: 'Scan the QR code with your TON wallet app.',
              uri: 'tc://e2e-ton-pairing',
              actionLabel: 'Open TON wallet',
            });
            await new Promise((resolve, reject) => {
              const onApprove = () => {
                cleanup();
                resolve(undefined);
              };
              const onCancel = () => {
                cleanup();
                reject(new Error('TON Connect pairing cancelled'));
              };
              const cleanup = () => {
                window.removeEventListener('e2e.ton-approve', onApprove);
                window.removeEventListener('e2e.ton-cancel', onCancel);
              };
              window.addEventListener('e2e.ton-approve', onApprove, { once: true });
              window.addEventListener('e2e.ton-cancel', onCancel, { once: true });
            });
            publishTonPrompt(null);
            sessionStorage.setItem('e2e.ton-connected', '1');
            return {
              account: '${tonAddress}',
              chainId: -239,
              identity: {
                connectorId: 'tonkeeper',
                address: '${tonAddress}',
                chainType: 'ton',
                walletType: 'external',
              },
            };
          },
        };

        const unisat = {
          id: 'unisat',
          label: 'UniSat',
          available: true,
          getPairingPrompt: () => null,
          subscribeToPairingPrompt: () => () => {},
          cancelPairingPrompt: () => {},
          subscribeToSessionChanges: () => () => {},
          getSession: async () => {
            if (!sessionStorage.getItem('e2e.unisat-connected')) return null;
            const accounts = await window.unisat?.getAccounts?.();
            const account = accounts?.[0];
            return typeof account === 'string' ? { account } : null;
          },
          signMessage: async () => ({ signature: 'e2e-unisat-sig' }),
          connect: async () => {
            if (!window.unisat) {
              throw new Error('UniSat extension not found');
            }
            await window.unisat.requestAccounts();
            const [account] = await window.unisat.getAccounts();
            if (typeof account !== 'string') {
              throw new Error('UniSat returned no account');
            }
            sessionStorage.setItem('e2e.unisat-connected', '1');
            return {
              account,
              identity: {
                connectorId: 'unisat',
                address: account,
                chainType: 'bitcoin',
                walletType: 'external',
              },
            };
          },
        };

        // Keep privy available so the connected embedded session can hydrate.
        const privy = {
          id: 'privy',
          label: 'Passkey',
          available: true,
          getPairingPrompt: () => null,
          subscribeToPairingPrompt: () => () => {},
          cancelPairingPrompt: () => {},
          subscribeToSessionChanges: () => () => {},
          getSession: async () => ({ account: '${ethAddress}', chainId: 1 }),
          signMessage: async () => ({ signature: 'e2e-privy-sig' }),
          connect: async () => ({
            account: '${ethAddress}',
            chainId: 1,
            identity: {
              connectorId: 'privy',
              address: '${ethAddress}',
              chainType: 'ethereum',
              walletType: 'embedded',
            },
          }),
        };

        const connectors = { tonkeeper, unisat, privy };
        export const connectorFactory = {
          create: id => connectors[id] ?? {
            id,
            label: id,
            available: false,
            getPairingPrompt: () => null,
            subscribeToPairingPrompt: () => () => {},
            cancelPairingPrompt: () => {},
            subscribeToSessionChanges: () => () => {},
            getSession: async () => null,
            signMessage: async () => {
              throw new Error('connector unavailable in e2e: ' + id);
            },
            connect: async () => {
              throw new Error('connector unavailable in e2e: ' + id);
            },
          },
          list: () => Object.values(connectors),
        };
      `,
    })
  );
}

test.describe('TON and UniSat connection with the real wallet remote', () => {
  test.skip(!gatewayUrl, 'Set WALLET_MFE_TEST_URL to the local MFE origin.');
  test.describe.configure({ timeout: 90_000 });

  test('TON Wallets opens a pairing modal then reaches connected state', async ({
    page,
  }) => {
    await installVitePreamble(page);
    await mockAuthProviderRuntime(page);
    await mockTonAndUnisatConnectors(page);
    await useConnectedWalletSession(page, `${gatewayUrl}/src/mount.tsx`);
    await mockWalletOwnershipLinkApis(page);

    await openConnectDrawer(page);
    const dialog = page.locator('.side-modal.open');
    const tonWallets = dialog.getByRole('button', { name: /TON Wallets/i });
    await expect(tonWallets).toBeVisible();
    await tonWallets.click();

    const pairing = page.getByRole('dialog', { name: /Connect TON wallet/i });
    await expect(pairing).toBeVisible();
    await expect(
      dialog.getByRole('status').filter({ hasText: /Connecting wallet/i })
    ).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new Event('e2e.ton-approve'));
    });

    await expect(pairing).toHaveCount(0);
    // Host auto-closes the connect drawer when the gateway reports connected.
    await expect(page.locator('.side-modal.open')).toHaveCount(0, {
      timeout: 15_000,
    });
    await page
      .locator('header')
      .getByRole('button', { name: 'Wallets', exact: true })
      .click();
    const reopened = page.locator('.side-modal.open');
    await expect(reopened).toBeVisible();
    await expect(reopened).toContainText(/EQDtes/i);
  });

  test('UniSat completes a mocked provider connection', async ({ page }) => {
    await installVitePreamble(page);
    await page.addInitScript(address => {
      const provider = {
        requestAccounts: async () => [address],
        getAccounts: async () => [address],
        getChain: async () => ({ enum: 'BITCOIN_MAINNET' }),
        signMessage: async () => 'sig',
        sendBitcoin: async () => 'txid',
        on: () => undefined,
        removeListener: () => undefined,
      };
      Object.defineProperty(window, 'unisat', {
        configurable: true,
        writable: true,
        value: provider,
      });
    }, bitcoinAddress);
    await mockAuthProviderRuntime(page);
    await mockTonAndUnisatConnectors(page);
    await useConnectedWalletSession(page, `${gatewayUrl}/src/mount.tsx`);
    await mockWalletOwnershipLinkApis(page);

    await openConnectDrawer(page);
    const dialog = page.locator('.side-modal.open');
    const unisat = dialog.getByRole('button', { name: /UniSat/i });
    await expect(unisat).toBeVisible();
    await unisat.click();

    // Host auto-closes the connect drawer when the gateway reports connected.
    await expect(page.locator('.side-modal.open')).toHaveCount(0, {
      timeout: 15_000,
    });
    await page
      .locator('header')
      .getByRole('button', { name: 'Wallets', exact: true })
      .click();
    const reopened = page.locator('.side-modal.open');
    await expect(reopened).toBeVisible();
    await expect(reopened).toContainText(/bc1qxy/i);
  });
});
