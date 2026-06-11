/**
 * Host copy of `mfe-wallets/src/contracts/intent-prepare.contract.ts`.
 * BFF validates and returns this shape; the host forwards it to the wallet MFE unchanged.
 */

export type IntentPrepareProtocol = 'near-intents';

export type DefuseAuthMethod =
  | 'evm'
  | 'near'
  | 'solana'
  | 'stellar'
  | 'ton'
  | 'tron'
  | 'webauthn';

export type NearIntentsTokenDelta = {
  assetId: string;
  amount: string;
};

type NearIntentsPrepareBase = {
  protocol: 'near-intents';
  quoteHashes: string[];
  signerId: string;
  authMethod: DefuseAuthMethod;
  deadlineTimestamp: number;
  nonce?: string;
};

export type NearIntentsSwapPrepareRequest = NearIntentsPrepareBase & {
  kind: 'swap';
  tokenDeltas: NearIntentsTokenDelta[];
  referral?: string;
  memo?: string;
  appFee?: NearIntentsTokenDelta[];
  appFeeRecipient?: string;
};

export type NearIntentsTransferPrepareRequest = NearIntentsPrepareBase & {
  kind: 'transfer';
  tokenDeltas: NearIntentsTokenDelta[];
  receiverId: string;
  memo?: string;
};

export type NearIntentsPrepareRequest =
  | NearIntentsSwapPrepareRequest
  | NearIntentsTransferPrepareRequest;

/** BFF-approved prepare package the host forwards to the wallet MFE. */
export type ApprovedIntentPrepareRequest = NearIntentsPrepareRequest;
