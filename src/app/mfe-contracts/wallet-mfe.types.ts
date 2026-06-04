import { WalletAccountChangedPayload } from './payloads';

export type WalletConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type WalletConnectionSnapshot = {
  status: WalletConnectionStatus;
  account: string | null;
  chainId: number | null;
  isVerified: boolean;
  safetyStatus: 'safe' | 'unsafe' | null;
  isBypassed: boolean;
  executionState: string;
  errorCode?: string;
  errorMessage?: string;
};

export type WalletsMfeEvent =
  | {
      type: 'connection.state.changed';
      payload: { status: WalletConnectionStatus };
    }
  | {
      type: 'wallet.connected';
      payload: { account: string; chainId: number | null };
    }
  | { type: 'wallet.disconnected'; payload: { reason?: string } }
  | { type: 'wallet.account.changed'; payload: { account: string } }
  | { type: 'wallet.chain.changed'; payload: { chainId: number } }
  | { type: 'connection.snapshot.updated'; payload: WalletConnectionSnapshot };

export type WalletsMfeContext = {
  contractVersion?: '2.0.0';
  sessionId?: string;
  locale?: string;
  theme?: 'light' | 'dark';
  environment?: 'dev' | 'staging' | 'prod';
};

export type WalletsMfeCallbacks = {
  onAccountChanged?: (payload: WalletAccountChangedPayload) => void;
  onCloseRequested?: () => void;
};

export type WalletsMfeMountApi = {
  unmount: () => void;
  subscribe: (listener: (event: WalletsMfeEvent) => void) => () => void;
  getSnapshot: () => WalletConnectionSnapshot;
};

export type WalletsMfeModule = {
  mount: (
    container: HTMLElement,
    props?: {
      context?: WalletsMfeContext;
      callbacks?: WalletsMfeCallbacks;
    }
  ) => WalletsMfeMountApi | (() => void) | void;
};
