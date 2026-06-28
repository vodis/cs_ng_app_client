export type PrivyEmbeddedWallet = {
  id?: string;
  address?: string;
  walletClientType?: string;
  chainType?: string;
  getEthereumProvider?: () => Promise<{
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  }>;
};

export type PrivyBridgeUser = {
  id?: string;
  email?: { address?: string };
  linkedAccounts?: Array<Record<string, unknown>>;
  wallet?: PrivyEmbeddedWallet;
};

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
    craftscriptPrivyConfig?: PublicAuthConfig;
    craftscriptPrivyError?: string;
    mountCraftscriptPrivyRuntime?: PrivyRuntimeFactory;
  }
}
