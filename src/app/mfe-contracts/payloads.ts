import { WalletEventName } from './events';

export interface WalletConnectedPayload {
  account: string;
  chainId: number;
  connector?: string;
}

export interface WalletDisconnectedPayload {
  reason?: string;
}

export interface WalletAccountChangedPayload {
  account: string;
}

export interface WalletChainChangedPayload {
  chainId: number;
}

export interface WalletTxSignedPayload {
  txHash?: string;
  chainId?: number;
}

/** Path B: wallet returned an intent signature; relay submit stays in the host. */
export interface WalletIntentSignedPayload {
  signature: Record<string, unknown>;
  authMethod: string;
}

export interface WalletErrorPayload {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export interface MfeEventEnvelope<TPayload = unknown> {
  eventName: WalletEventName;
  eventVersion: number;
  traceId: string;
  timestamp: string;
  source: 'mfe-wallets' | 'host';
  payload: TPayload;
}
