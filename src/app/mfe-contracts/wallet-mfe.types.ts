import { WalletAccountChangedPayload } from './payloads';

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

export type WalletsMfeModule = {
  mount: (
    container: HTMLElement,
    props?: {
      context?: WalletsMfeContext;
      callbacks?: WalletsMfeCallbacks;
    }
  ) => (() => void) | void;
};
