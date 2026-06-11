import type { DefuseAuthMethod } from './intent-prepare.contract';

/** Wallet-returned signature envelope (Defuse `WalletSignatureResult`). */
export type DefuseWalletSignatureResult = Record<string, unknown>;

/** Relay wire format after `prepareBroadcastRequest.prepareSwapSignedData`. */
export type DefuseSignedIntentData = Record<string, unknown>;

export type WalletExecutionFailureCode =
  | 'NOT_CONNECTED'
  | 'NOT_VERIFIED'
  | 'SIGN_REJECTED'
  | 'SIGN_FAILED'
  | 'SUBMIT_FAILED'
  | 'PREPARE_FAILED'
  | 'QUOTE_FAILED'
  | 'GATEWAY_UNAVAILABLE';

export type WalletExecutionFailure = {
  code: WalletExecutionFailureCode;
  message: string;
  retryable: boolean;
};

export type WalletExecutionSuccess = {
  kind: 'intent_sign';
  intentHash: string;
  signature: DefuseWalletSignatureResult;
};

export type WalletExecutionResult =
  | { ok: true; value: WalletExecutionSuccess }
  | { ok: false; error: WalletExecutionFailure };

export type IntentRelayUserInfo = {
  userAddress: string;
  userChainType: DefuseAuthMethod;
};

export type IntentRelaySubmitInput = {
  signedIntent: DefuseSignedIntentData;
  quoteHashes: string[];
  user: IntentRelayUserInfo;
};
