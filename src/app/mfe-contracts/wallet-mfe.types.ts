import type { SwapSettlementResult } from './swap-review.types';
import type {
  WalletSwapInput,
  WalletSwapQuote,
  WalletSwapQuoteOptions,
  WalletSwapReview,
} from './swap-review.types';
import type { WalletGatewayEvent } from './gateway-events';
import type { WalletBalancesSnapshot } from './wallet-balances.types';
import {
  WalletAccountChangedPayload,
  WalletIntentSignedPayload,
} from './payloads';
import type { SwapReviewIntent, SwapReviewServices } from './swap-review.types';

/** Backend-owned preference; never evidence of a live provider session. */
export type WalletSelection =
  | { status: 'pending' | 'unauthenticated' }
  | {
      status: 'authenticated';
      userId: string;
      wallet: {
        id: string;
        address: string;
        chainType: string;
        walletType: string;
        source?: string;
      } | null;
    };

export type WalletConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type WalletConnectorId =
  | 'metamask'
  | 'walletconnect'
  | 'coinbase'
  | 'near'
  | 'tonkeeper'
  | 'privy';

export type WalletIdentity = {
  connectorId: WalletConnectorId;
  address: string;
  providerWalletId?: string;
  chainType: 'ethereum' | 'near' | 'ton';
  walletType: 'embedded' | 'external';
};

export type WalletConnectionSnapshot = {
  restorationStatus?: 'pending' | 'restoring' | 'complete' | 'failed';
  status: WalletConnectionStatus;
  account: string | null;
  chainId: number | null;
  identity?: WalletIdentity | null;
  isVerified: boolean;
  safetyStatus: 'safe' | 'unsafe' | null;
  isBypassed: boolean;
  executionState: string;
  errorCode?: string;
  errorMessage?: string;
  linkStatus?: 'checking' | 'unlinked' | 'linking' | 'linked' | 'error';
};

export type WalletOnboardingResult = {
  account: string;
  chainId: number | null;
  walletType: 'embedded' | 'external';
  source: string;
};

export type WalletsMfeEvent =
  | {
      type: 'connection.state.changed';
      payload: { status: WalletConnectionStatus };
    }
  | {
      type: 'wallet.connected';
      payload: {
        account: string;
        chainId: number | null;
        identity?: WalletIdentity | null;
      };
    }
  | { type: 'wallet.disconnected'; payload: { reason?: string } }
  | { type: 'wallet.account.changed'; payload: { account: string } }
  | { type: 'wallet.chain.changed'; payload: { chainId: number } }
  | { type: 'connection.snapshot.updated'; payload: WalletConnectionSnapshot }
  /** @deprecated Balances are fetched by the authenticated Angular host. */
  | { type: 'balances.updated'; payload: WalletBalancesSnapshot };

export type WalletsMfeContext = {
  selection?: WalletSelection;
  contractVersion?: '2.0.0' | '2.1.0' | '2.2.0' | '2.3.0';
  apiBaseUrl?: string;
  sessionId?: string;
  locale?: string;
  theme?: 'light' | 'dark';
  environment?: 'dev' | 'staging' | 'prod';
};

export type WalletsMfeCallbacks = {
  onAccountChanged?: (payload: WalletAccountChangedPayload) => void;
  onCloseRequested?: () => void;
  onChainChanged?: (payload: { chainId: number }) => void;
  onVerificationChanged?: (payload: {
    isVerified: boolean;
    reason?: string;
  }) => void;
  onWalletSafetyChanged?: (payload: {
    safetyStatus: 'safe' | 'unsafe';
    isBypassed?: boolean;
  }) => void;
  onExecutionStateChanged?: (payload: {
    state: string;
    reason?: string;
    errorCode?: string;
  }) => void;
  /** Emitted when the gateway completes intent signing (Path B). */
  onIntentSigned?: (payload: WalletIntentSignedPayload) => void;
  onTransactionSubmitted?: (payload: { hash: string }) => void;
  onSwapSettled?: (result: SwapSettlementResult) => void;
  onSwapSubmitted?: (payload: { traceId: string; intentHash: string }) => void;
  onSwapPreviewRefreshRequested?: (payload: { traceId: string }) => void;
};

export type WalletsMfeMountApi = {
  dialogCloseVersion?: '1.0.0';
  selectionContractVersion?: '1.0.0';
  updateSelection?: (selection: WalletSelection) => void;
  unmount: () => void;
  subscribe: (listener: (event: WalletsMfeEvent) => void) => () => void;
  getSnapshot: () => WalletConnectionSnapshot;
  sendGatewayEvent: (event: WalletGatewayEvent) => void;
  createEmbeddedWallet?: () => Promise<WalletOnboardingResult>;
  syncConnectedWallet?: () => Promise<WalletConnectionSnapshot>;
  disconnectWallet?: () => void;
  swapContractVersion?: '2.0.0';
  walletFundingVersion?: '1.0.0';
  /** Selected-wallet previews and MFE-owned execution readiness. */
  executionReadinessVersion?: '1.0.0';
  requestSwapQuote?: (
    input: WalletSwapInput,
    options: WalletSwapQuoteOptions
  ) => Promise<WalletSwapQuote>;
  openWalletSwapReview?: (review: WalletSwapReview) => void;
  openSwapReview?: (intent: SwapReviewIntent) => void;
  closeSwapReview?: () => void;
  isSwapReviewBusy?: () => boolean;
};

export type WalletsMfeModule = {
  mount: (
    container: HTMLElement,
    props?: {
      context?: WalletsMfeContext;
      callbacks?: WalletsMfeCallbacks;
      services?: SwapReviewServices;
    }
  ) => WalletsMfeMountApi | (() => void) | void;
};
