declare module '@privy-io/react-auth' {
  import type { ComponentType, ReactNode } from 'react';

  export type PrivyProviderProps = {
    appId: string;
    clientId?: string;
    config?: Record<string, unknown>;
    children?: ReactNode;
  };

  export const PrivyProvider: ComponentType<PrivyProviderProps>;

  export function usePrivy(): {
    ready: boolean;
    authenticated: boolean;
    user: unknown;
    login: () => Promise<void>;
    getAccessToken: () => Promise<string | null>;
  };

  export function useWallets(): {
    ready: boolean;
    wallets: unknown[];
  };
}
