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
            getWalletSession: async () => ({ account: '0xa000000000000000000000000000000000000001', chainId: 1 }),
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
            id: 'near', label: 'NEAR', available: true, getPairingPrompt: () => null,
            subscribeToPairingPrompt: () => () => {}, cancelPairingPrompt: () => {},
            subscribeToSessionChanges: () => () => {},
            getSession: async () => {
              if (sessionStorage.getItem('test.defer-connect')) return null;
              const mode = sessionStorage.getItem('test.reconnect-success') ? 'connected' : '${mode}';
              if (mode === 'rejected') return null;
              return { account: mode === 'wrong' ? 'other.near' : 'active.near' };
            },
            connect: async () => {
              if (sessionStorage.getItem('test.defer-connect')) {
                await new Promise(resolve => {
                  window.addEventListener('test.release-connect', resolve, { once: true });
                  window.dispatchEvent(new Event('test.connect-started'));
                });
              }
              const mode = sessionStorage.getItem('test.reconnect-success') ? 'connected' : '${mode}';
              if (mode === 'rejected') throw new Error('Connection cancelled');
              const address = mode === 'wrong' ? 'other.near' : 'active.near';
              return { account: address, identity: { connectorId: 'near', address, chainType: 'near', walletType: 'external' } };
            }
          };
          const embedded = { ...connector, id: 'privy', label: 'Passkey', getSession: async () => ({ account: '0xa000000000000000000000000000000000000001', chainId: 1 }) };
          export const connectorFactory = { create: id => id === 'privy' ? embedded : connector, list: () => [connector, embedded] };
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
          mode === 'embedded' || mode === 'connected'
            ? 'Active · Connected'
            : 'Active · Signing disconnected'
        );
        await expect(
          page.locator('.wallets-mfe section[aria-label="Active wallet"]')
        ).toHaveCount(0);
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
      // Silent external restoration must never register or mutate a wallet.
      expect(writes).toEqual([]);
      if (mode === 'wrong' || mode === 'rejected') {
        await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
          'Active · Signing disconnected'
        );
        await page
          .getByRole('button', { name: 'Reconnect', exact: true })
          .click();
        const nearWallet = page
          .locator('.wallets-mfe')
          .getByRole('button', { name: /NEAR Wallet/ });
        await expect(nearWallet).toBeVisible();
        await page.evaluate(() =>
          sessionStorage.setItem('test.reconnect-success', '1')
        );
        await nearWallet.click();
      }
      await expect(page.locator('.profile-shell__wallet-badge')).toHaveText(
        'Active · Connected'
      );
      expect(browserErrors).toEqual([]);
      if (providerDelay === 0 && mode === 'connected') {
        const cancellationResults = await page.evaluate(async url => {
          const remote: {
            mount: (
              container: HTMLElement,
              props: { context: WalletsMfeContext }
            ) => WalletsMfeMountApi;
          } = await import(url);
          const container = document.createElement('div');
          document.body.appendChild(container);
          sessionStorage.setItem('test.defer-connect', '1');
          const api = remote.mount(container, {
            context: {
              selection: {
                status: 'authenticated',
                userId: 'user',
                wallet: {
                  id: 'near',
                  address: 'active.near',
                  chainType: 'near',
                  walletType: 'external',
                  source: 'near',
                },
              },
            },
          });
          const results: string[] = [];
          try {
            const sync = api.syncConnectedWallet;
            if (!sync) throw new Error('Reconnect API unavailable');
            for (const type of ['RESET', 'ABORT'] as const) {
              sessionStorage.setItem('test.defer-connect', '1');
              let started = false;
              const onStarted = () => {
                started = true;
              };
              window.addEventListener('test.connect-started', onStarted);
              let pending: Promise<string> = Promise.resolve('not started');
              for (let attempt = 0; attempt < 50 && !started; attempt++) {
                pending = sync().then(
                  () => 'connected',
                  error => error.message
                );
                await new Promise(resolve => setTimeout(resolve, 20));
              }
              window.removeEventListener('test.connect-started', onStarted);
              if (!started) throw new Error('Reconnect did not start');
              api.sendGatewayEvent({ type });
              results.push(
                await Promise.race([
                  pending,
                  new Promise<string>(resolve =>
                    setTimeout(() => resolve('timed out'), 1000)
                  ),
                ])
              );
              sessionStorage.removeItem('test.defer-connect');
              window.dispatchEvent(new Event('test.release-connect'));
              await new Promise(resolve => setTimeout(resolve, 20));
              const retry = await sync();
              results.push(retry.account ?? 'no account');
              sessionStorage.setItem('test.defer-connect', '1');
              api.sendGatewayEvent({ type: 'RESET' });
              await new Promise(resolve => setTimeout(resolve, 20));
            }
            return results;
          } finally {
            sessionStorage.removeItem('test.defer-connect');
            window.dispatchEvent(new Event('test.release-connect'));
            api.unmount();
            container.remove();
          }
        }, `${gatewayUrl}/src/mount.tsx`);
        expect(cancellationResults).toEqual([
          'Wallet connection cancelled.',
          'active.near',
          'Wallet connection cancelled.',
          'active.near',
        ]);

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
        expect(staleAccounts).not.toContain(
          '0xa000000000000000000000000000000000000001'
        );
        expect(staleAccounts).toEqual(['active.near']);

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
