import type { Page, Route } from '@playwright/test';

import { resolveWalletRemoteEntryUrl } from '../../src/app/mfe-contracts/wallet-remote-entrypoints';
import { environment } from '../../src/environments/environment';

export const API_BASE_URL = environment.apiUrl.replace(/\/+$/, '');
const AUTH_PROVIDER_REMOTE_ENTRY_URL = resolveWalletRemoteEntryUrl(
  environment.mfeWalletsRemoteUrl
);
const E2E_ACCESS_TOKEN = 'e2e-access-token';
const CROSS_ORIGIN_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, PATCH, OPTIONS',
};

export type E2eAuthUser = {
  id: string;
  providerUserId: string;
  sessionId: string;
  email?: string | null;
  authMethod?: string | null;
  passkeyEnabled?: boolean;
};

export type E2eAuthWallet = {
  id: string;
  providerWalletId: string;
  address: string;
  chainType: string;
  walletType: string;
  source?: string;
  status?: string;
  isPrimary: boolean;
  deletedAt?: string | null;
};

export type E2eAuthenticatedSession = {
  user: E2eAuthUser;
  wallets: E2eAuthWallet[];
  accessToken: string;
};

const DEFAULT_AUTHENTICATED_SESSION: E2eAuthenticatedSession = {
  user: {
    id: 'e2e-user',
    providerUserId: 'e2e-provider-user',
    sessionId: 'e2e-session',
    email: 'e2e@craftscript.test',
    authMethod: 'email',
    passkeyEnabled: false,
  },
  wallets: [
    {
      id: 'e2e-wallet',
      providerWalletId: 'e2e-provider-wallet',
      address: '0x0000000000000000000000000000000000000001',
      chainType: 'evm',
      walletType: 'embedded',
      source: 'e2e',
      status: 'active',
      isPrimary: true,
      deletedAt: null,
    },
  ],
  accessToken: E2E_ACCESS_TOKEN,
};

export async function useGuestSession(page: Page): Promise<void> {
  await mockAuthProviderRemote(page, null);
}

export async function useAuthenticatedSession(
  page: Page,
  session: E2eAuthenticatedSession = DEFAULT_AUTHENTICATED_SESSION
): Promise<void> {
  await mockAuthProviderRemote(page, session);
  await mockAuthSessionApi(page, session);
}

export async function mockJsonApi(
  page: Page,
  path: string,
  body: unknown
): Promise<void> {
  await page.route(
    url => matchesOriginPath(url, `${API_BASE_URL}${path}`),
    route => fulfillJson(route, body)
  );
}

async function mockAuthProviderRemote(
  page: Page,
  session: E2eAuthenticatedSession | null
): Promise<void> {
  await page.route(
    url => matchesOriginPath(url, AUTH_PROVIDER_REMOTE_ENTRY_URL),
    async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: CROSS_ORIGIN_HEADERS,
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        headers: CROSS_ORIGIN_HEADERS,
        body: createAuthProviderRemoteEntry(session),
      });
    }
  );
}

async function mockAuthSessionApi(
  page: Page,
  session: E2eAuthenticatedSession
): Promise<void> {
  await mockJsonApi(page, '/api/v1/me', { user: session.user });
  await mockJsonApi(page, '/api/v1/wallets', { wallets: session.wallets });
}

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200
): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({
      status: 204,
      headers: CROSS_ORIGIN_HEADERS,
    });
    return;
  }

  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CROSS_ORIGIN_HEADERS,
    body: JSON.stringify(body),
  });
}

function matchesOriginPath(url: URL, expected: string): boolean {
  const target = new URL(expected);
  return url.origin === target.origin && url.pathname === target.pathname;
}

function createAuthProviderRemoteEntry(
  session: E2eAuthenticatedSession | null
): string {
  const serializedSession = JSON.stringify(
    session
      ? {
          user: session.user,
          wallets: session.wallets,
        }
      : null
  );
  const serializedAccessToken = JSON.stringify(session?.accessToken ?? null);

  return `
const snapshot = {
  status: 'ready',
  loginMethods: ['email'],
  passkeyLoginEnabled: false,
  passkeySignupEnabled: false,
  passkeyLinkEnabled: false,
  embeddedWalletEnabled: true
};
const session = ${serializedSession};
const walletSnapshot = {
  status: 'disconnected',
  account: null,
  chainId: null,
  isVerified: false,
  safetyStatus: null,
  isBypassed: false,
  executionState: 'operating.idle'
};
const modules = {
  'auth-provider': {
    mountAuthProvider: function () {
      return {
        contractVersion: '2.3.0',
        unmount: function () {},
        subscribe: function (listener) {
          queueMicrotask(function () { listener(snapshot); });
          return function () {};
        },
        getSnapshot: function () { return snapshot; },
        login: function () {
          return session
            ? Promise.resolve(session)
            : Promise.reject(new Error('No e2e session'));
        },
        sendEmailCode: function () { return Promise.resolve(); },
        verifyEmailCode: function () {
          return session
            ? Promise.resolve(session)
            : Promise.reject(new Error('No e2e session'));
        },
        linkPasskey: function () {
          return session
            ? Promise.resolve(session)
            : Promise.reject(new Error('No e2e session'));
        },
        ensureEmbeddedWallet: function () {
          return session && session.wallets[0]
            ? Promise.resolve(session.wallets[0])
            : Promise.reject(new Error('No e2e session'));
        },
        logout: function () { return Promise.resolve(); },
        getAccessToken: function () {
          return Promise.resolve(${serializedAccessToken});
        }
      };
    }
  },
  'mount': {
    mount: function () {
      return {
        unmount: function () {},
        subscribe: function () { return function () {}; },
        getSnapshot: function () { return walletSnapshot; },
        disconnectWallet: function () {},
        sendGatewayEvent: function () {}
      };
    }
  }
};

export function init() {
  return Promise.resolve();
}

export function get(exposedModule) {
  const key = exposedModule.replace(/^\\.\\//, '');
  const module = modules[key];
  if (!module) {
    return Promise.reject(new Error('Unknown e2e remote module: ' + exposedModule));
  }
  return Promise.resolve(function () { return module; });
}
`;
}
