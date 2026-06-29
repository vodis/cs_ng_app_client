/**
 * Structural consumer copy of the canonical contract at
 * cs_mfe-wallets/src/contracts/auth-provider-contract.ts.
 *
 * The wallet MFE is the single source of truth. Keep this copy compatible and
 * reject unsupported contract versions at runtime.
 */
export type AuthProviderContractVersion = '1.0.0';

export const AUTH_PROVIDER_CONTRACT_VERSION: AuthProviderContractVersion =
  '1.0.0';

export type AuthProviderLoginMethod = 'email' | 'google' | 'apple' | 'passkey';

export type PublicAuthConfig = {
  version?: 1;
  enabled?: boolean;
  provider?: 'privy';
  privyAppId: string | null;
  loginMethods: AuthProviderLoginMethod[];
  walletOnboarding: {
    embeddedWallet: boolean;
    externalWalletBinding: boolean;
  };
};

export type AuthProviderStatus = 'loading' | 'ready' | 'disabled' | 'failed';

export type AuthProviderSnapshot = {
  status: AuthProviderStatus;
  loginMethods: AuthProviderLoginMethod[];
  error?: string;
};

export type AuthProviderUser = {
  id: string;
  email?: { address: string };
};

export type AuthProviderListener = (snapshot: AuthProviderSnapshot) => void;

export type AuthProviderMountApi = {
  contractVersion: AuthProviderContractVersion;
  unmount: () => void;
  subscribe: (listener: AuthProviderListener) => () => void;
  getSnapshot: () => AuthProviderSnapshot;
  login: (method: AuthProviderLoginMethod) => Promise<AuthProviderUser | void>;
  getAccessToken: () => Promise<string | null>;
  getUser: () => Promise<AuthProviderUser | null>;
};

export type AuthProviderRemoteModule = {
  mountAuthProvider: (
    container: HTMLElement,
    props: { config: PublicAuthConfig }
  ) => AuthProviderMountApi;
};
