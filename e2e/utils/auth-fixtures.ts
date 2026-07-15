import type { Page } from '@playwright/test';

const AUTH_PROVIDER_REMOTE_ENTRY_URL =
  'https://wallets.craftscript.com/remoteEntry.js';
const API_BASE_URL = 'https://api.craftscript.com';
const E2E_ACCESS_TOKEN = 'e2e-access-token';
const CROSS_ORIGIN_HEADERS = {
  'Access-Control-Allow-Origin': '*',
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

export async function useAuthenticatedSession(
  page: Page,
  session: E2eAuthenticatedSession = DEFAULT_AUTHENTICATED_SESSION
): Promise<void> {
  await mockAuthProviderRemote(page, session);
  await mockAuthSessionApi(page, session);
}

async function mockAuthProviderRemote(
  page: Page,
  session: E2eAuthenticatedSession
): Promise<void> {
  await page.route(AUTH_PROVIDER_REMOTE_ENTRY_URL, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      headers: CROSS_ORIGIN_HEADERS,
      body: createAuthProviderRemoteEntry(session),
    })
  );
}

async function mockAuthSessionApi(
  page: Page,
  session: E2eAuthenticatedSession
): Promise<void> {
  await page.route(`${API_BASE_URL}/api/v1/me`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CROSS_ORIGIN_HEADERS,
      body: JSON.stringify({ user: session.user }),
    })
  );

  await page.route(`${API_BASE_URL}/api/v1/wallets`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CROSS_ORIGIN_HEADERS,
      body: JSON.stringify({ wallets: session.wallets }),
    })
  );
}

function createAuthProviderRemoteEntry(
  session: E2eAuthenticatedSession
): string {
  const serializedSession = JSON.stringify({
    user: session.user,
    wallets: session.wallets,
  });
  const serializedAccessToken = JSON.stringify(session.accessToken);

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
        contractVersion: '2.2.0',
        unmount: function () {},
        subscribe: function (listener) {
          queueMicrotask(function () { listener(snapshot); });
          return function () {};
        },
        getSnapshot: function () { return snapshot; },
        login: function () { return Promise.resolve(session); },
        sendEmailCode: function () { return Promise.resolve(); },
        verifyEmailCode: function () { return Promise.resolve(session); },
        linkPasskey: function () { return Promise.resolve(session); },
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
