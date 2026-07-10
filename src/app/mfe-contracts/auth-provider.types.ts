/**
 * Structural consumer copy of the canonical contract at
 * cs_mfe-wallets/src/contracts/auth-provider-contract.ts.
 *
 * The wallet MFE is the single source of truth. Keep this copy compatible and
 * reject unsupported contract versions at runtime.
 */
export type AuthProviderContractVersion = '2.1.0';

export const AUTH_PROVIDER_CONTRACT_VERSION: AuthProviderContractVersion =
  '2.1.0';

export type AuthProviderLoginMethod = 'email' | 'google' | 'apple' | 'passkey';

export type AuthProviderStatus = 'loading' | 'ready' | 'disabled' | 'failed';

export type AuthProviderSnapshot = {
  status: AuthProviderStatus;
  loginMethods: AuthProviderLoginMethod[];
  embeddedWalletEnabled: boolean;
  error?: string;
};

export type AuthProviderUser = {
  id: string;
  providerUserId: string;
  sessionId: string;
  email?: string | null;
  authMethod?: string | null;
};

export type AuthProviderWallet = {
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

export type AuthProviderSession = {
  user: AuthProviderUser;
  wallets: AuthProviderWallet[];
};

export type AuthProviderEmailCodeInput = {
  email: string;
  code: string;
};

export type AuthProviderListener = (snapshot: AuthProviderSnapshot) => void;

export type AuthProviderMountApi = {
  contractVersion: AuthProviderContractVersion;
  unmount: () => void;
  subscribe: (listener: AuthProviderListener) => () => void;
  getSnapshot: () => AuthProviderSnapshot;
  login: (method: AuthProviderLoginMethod) => Promise<AuthProviderSession>;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (
    input: AuthProviderEmailCodeInput
  ) => Promise<AuthProviderSession>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

export type AuthProviderRemoteModule = {
  mountAuthProvider: (
    container: HTMLElement,
    props: { apiBaseUrl: string }
  ) => AuthProviderMountApi;
};
