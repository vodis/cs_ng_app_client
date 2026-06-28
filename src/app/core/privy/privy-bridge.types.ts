import type {
  AuthProviderUser,
  AuthProviderWallet,
} from '@core/auth/auth-provider.gateway';

export type PrivyEmbeddedWallet = AuthProviderWallet & {
  getEthereumProvider?: () => Promise<{
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  }>;
};

export type PrivyBridgeUser = AuthProviderUser;

export type PublicAuthLoginMethod = 'email' | 'google' | 'apple' | 'passkey';

export type CraftscriptPrivyBridge = {
  login: (method?: PublicAuthLoginMethod) => Promise<PrivyBridgeUser | void>;
  getAccessToken: () => Promise<string | null>;
  getUser: () => Promise<PrivyBridgeUser | null>;
  getEmbeddedWallet: () => Promise<PrivyEmbeddedWallet | null>;
  signMessage: (input: {
    message: string;
    address?: string;
  }) => Promise<{ signature: string }>;
  sendTransaction: (input: {
    from: string;
    to: string;
    value?: string;
    data?: string;
  }) => Promise<{ hash: string }>;
};

export type PublicAuthConfig = {
  version?: 1;
  enabled?: boolean;
  provider?: 'privy';
  privyAppId: string | null;
  loginMethods: PublicAuthLoginMethod[];
  walletOnboarding: {
    embeddedWallet: boolean;
    externalWalletBinding: boolean;
  };
};

export type PrivyRuntimeHandle = {
  destroy: () => void;
};

export type PrivyRuntimeFactory = (
  config: PublicAuthConfig,
  onReady: (bridge: CraftscriptPrivyBridge) => void
) => PrivyRuntimeHandle;

declare global {
  interface Window {
    craftscriptPrivy?: CraftscriptPrivyBridge;
    craftscriptPrivySource?: CraftscriptPrivyBridge;
    mountCraftscriptPrivyRuntime?: PrivyRuntimeFactory;
  }
}
