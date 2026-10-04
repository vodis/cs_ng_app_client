import type {
  WalletsMfeMountApi,
  WalletsMfeContext,
} from '../src/app/mfe-contracts/wallet-mfe.types';
import { expect, test } from '@playwright/test';
import {
  API_BASE_URL,
  mockJsonApi,
  useAuthenticatedSession,
} from './utils/auth-fixtures';

// Run with the sibling wallet MFE dev server on port 5002. Only provider I/O
// is mocked; mount, React effects, gateway actors and Angular integration are real.
const gatewayUrl = process.env.WALLET_MFE_TEST_URL;

test.describe('active-wallet persistence with the real gateway', () => {
  test.skip(!gatewayUrl, 'Set WALLET_MFE_TEST_URL to the local MFE origin.');

  for (const [providerDelay, mode] of [
    [0, 'connected'],
    [300, 'connected'],
    [0, 'wrong'],
    [0, 'rejected'],
    [0, 'embedded'],
  ] as const) {
    test(`persists ${mode} wallet flow (provider delay ${providerDelay}ms)`, async ({
      page,
    }) => {
      const browserErrors: string[] = [];
      page.on('pageerror', error => browserErrors.push(error.message));
      await page.addInitScript(() => {
        Object.assign(window, {
          __vite_plugin_react_preamble_installed__: true,
          $RefreshReg$: () => {},
          $RefreshSig$: () => (value: unknown) => value,
        });
      });
      await page.route(
        '**/src/features/auth-provider/model/auth-provider.runtime.ts*',
        route =>
          route.fulfill({
            contentType: 'application/javascript',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: `
          let snapshot = { status: 'loading', embeddedWalletEnabled: true };
          const listeners = new Set();
          setTimeout(() => { snapshot = { ...snapshot, status: 'ready' }; listeners.forEach(fn => fn()); }, ${providerDelay});
          export const authProviderRuntime = {
            subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
            getSnapshot: () => snapshot,
            getAccessToken: async () => 'test-token',
            peekEmbeddedWallet: async () => {
              if (sessionStorage.getItem('test.defer-peek')) {
                await new Promise(resolve => {
                  window.addEventListener('test.release-peek', resolve, { once: true });
                  window.dispatchEvent(new Event('test.peek-started'));
                });
              }
              return { address: '0xa000000000000000000000000000000000000001', chainType: 'ethereum' };
            },
            bindEmbeddedWallet: async (identity, restoreOnly) => fetch('${API_BASE_URL}/api/v1/wallets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, restoreOnly }) })
          };
        `,
          })
      );
      await page.route('**/src/connectors/connector-factory.ts*', route =>
        route.fulfill({
          contentType: 'application/javascript',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: `
          const connector = {
            available: true, getPairingPrompt: () => null,
            subscribeToPairingPrompt: () => () => {}, cancelPairingPrompt: () => {},
            connect: async () => {
              const mode = sessionStorage.getItem('test.reconnect-success') ? 'connected' : '${mode}';
              if (mode === 'rejected') throw new Error('Connection cancelled');
              const address = mode === 'wrong' ? 'other.near' : 'active.near';
              return { account: address, identity: { connectorId: 'near', address, chainType: 'near', walletType: 'external' } };
            }
          };
          export const connectorFactory = { create: () => connector, list: () => [connector] };
        `,
        })
      );
      await useAuthenticatedSession(
        page,
        {
          user: {
            id: 'user',
            providerUserId: 'provider',
            sessionId: 'session',
          },
          accessToken: 'test-token',
          wallets: [
            {
              id: 'evm',
              providerWalletId: 'evm',
              address: '0xa000000000000000000000000000000000000001',
              chainType: 'ethereum',
              walletType: 'embedded',
              source: 'privy',
              isPrimary: mode === 'embedded',
            },
            ...(mode === 'embedded'
              ? []
              : [
                  {
                    id: 'near',
                    providerWalletId: 'near',
                    address: 'active.near',
                    chainType: 'near',
                    walletType: 'external',
                    source: 'near',
                    isPrimary: true,
                  },
                ]),
          ],
        },
        `${gatewayUrl}/src/mount.tsx`
      );
      await mockJsonApi(page, '/api/v1/assets', { data: [] });
      await mockJsonApi(page, '/api/v1/balances', { data: [] });
      await mockJsonApi(page, '/api/v1/portfolio', {
        totalValue: '0',
        positions: [],
        unpricedPositionCount: 0,
      });
      const writes: string[] = [];
      page.on('request', request => {
        if (
          ['POST', 'PATCH', 'DELETE'].includes(request.method()) &&
          new URL(request.url()).pathname.startsWith('/api/v1/wallets')
        )
          writes.push(request.url());
      });
      await page.goto('/en/profile');
      for (let reload = 0; reload < 3; reload++) {
        await expect(page.locator('.wallets-mfe')).toBeAttached();
        await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
          mode === 'embedded'
            ? 'Active · Connected'
            : 'Active · Reconnect required'
        );
        if (mode !== 'embedded')
          await expect(
            page.locator('.wallets-mfe section[aria-label="Active wallet"]')
          ).toContainText('active.near');
        await page.reload();
      }
      await expect(page.locator('.wallets-mfe')).toBeAttached();
      if (mode === 'embedded') {
        await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
          'Active · Connected'
        );
        expect(writes.length).toBeGreaterThan(0);
        expect(browserErrors).toEqual([]);
        return;
      }
      await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
        'Active · Reconnect required'
      );
      await expect(
        page.locator('.wallets-mfe section[aria-label="Active wallet"]')
      ).toContainText('active.near');
      await page
        .getByRole('button', { name: 'Reconnect', exact: true })
        .click();
      if (mode === 'wrong' || mode === 'rejected') {
        await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
          'Active · Reconnect required'
        );
        await expect(
          page.locator('.wallets-mfe section[aria-label="Active wallet"]')
        ).toBeVisible();
        await page.evaluate(() =>
          sessionStorage.setItem('test.reconnect-success', '1')
        );
        await page
          .locator('.wallets-mfe')
          .getByRole('button', { name: 'Reconnect', exact: true })
          .click();
      }
      await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
        'Active · Connected'
      );
      expect(writes).toEqual([]);
      expect(browserErrors).toEqual([]);
      if (providerDelay === 0 && mode === 'connected') {
        const staleAccounts = await page.evaluate(async url => {
          const remote: {
            mount: (
              container: HTMLElement,
              props: { context: WalletsMfeContext }
            ) => WalletsMfeMountApi;
          } = await import(url);
          const container = document.createElement('div');
          document.body.appendChild(container);
          const started = new Promise<void>(resolve =>
            window.addEventListener('test.peek-started', () => resolve(), {
              once: true,
            })
          );
          sessionStorage.setItem('test.defer-peek', '1');
          const api = remote.mount(container, {
            context: {
              selection: {
                status: 'authenticated',
                userId: 'user',
                wallet: {
                  id: 'evm',
                  address: '0xa000000000000000000000000000000000000001',
                  chainType: 'ethereum',
                  walletType: 'embedded',
                  source: 'privy',
                },
              },
            },
          });
          const accounts: string[] = [];
          const unsubscribe = api.subscribe(event => {
            if (event.type === 'wallet.connected')
              accounts.push(event.payload.account);
          });
          try {
            await started;
            api.updateSelection?.({
              status: 'authenticated',
              userId: 'user',
              wallet: {
                id: 'near',
                address: 'active.near',
                chainType: 'near',
                walletType: 'external',
                source: 'near',
              },
            });
            window.dispatchEvent(new Event('test.release-peek'));
            await new Promise(resolve => setTimeout(resolve, 100));
            return accounts;
          } finally {
            unsubscribe();
            api.unmount();
            container.remove();
            sessionStorage.removeItem('test.defer-peek');
          }
        }, `${gatewayUrl}/src/mount.tsx`);
        expect(staleAccounts).toEqual([]);

        await mockJsonApi(page, '/api/v1/wallets', {
          wallets: [
            {
              id: 'evm',
              providerWalletId: 'evm',
              address: '0xa000000000000000000000000000000000000001',
              chainType: 'ethereum',
              walletType: 'embedded',
              source: 'privy',
              isPrimary: true,
            },
          ],
        });
        await mockJsonApi(page, '/api/v1/wallets/near', { status: 'deleted' });
        await page.getByRole('button', { name: 'Remove', exact: true }).click();
        await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
          'Active · Connected'
        );
        await expect(
          page.getByRole('button', { name: 'Remove', exact: true })
        ).toHaveCount(0);
        await page.reload();
        await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
          'Active · Connected'
        );
      }
    });
  }
});
