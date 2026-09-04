import type { ApprovedIntentPrepareRequest } from './intent-prepare.contract';

/** Mirrors `mfe-wallets` wallet gateway events used for Path B intent signing. */
export type WalletGatewayEvent =
  | { type: 'VERIFY_REQUESTED' }
  | {
      type: 'PREPARE_INTENT_MESSAGE_REQUESTED';
      request: ApprovedIntentPrepareRequest;
    }
  | { type: 'SIGN_REQUESTED' }
  | { type: 'ABORT' }
  | { type: 'RESET' }
  /** @deprecated The MFE accepts this only as a migration no-op. */
  | { type: 'BALANCES_SYNC_REQUESTED'; chainId?: number };

export const WALLET_GATEWAY_EVENTS = {
  verifyRequested: 'VERIFY_REQUESTED',
  prepareIntentMessageRequested: 'PREPARE_INTENT_MESSAGE_REQUESTED',
  signRequested: 'SIGN_REQUESTED',
  abort: 'ABORT',
  reset: 'RESET',
  /** @deprecated Use the host balance facade. */
  balancesSyncRequested: 'BALANCES_SYNC_REQUESTED',
} as const;
