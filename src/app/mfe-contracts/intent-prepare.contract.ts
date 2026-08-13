/**
 * Host copy of `mfe-wallets/src/contracts/intent-prepare.contract.ts`.
 * BFF validates and returns this shape; the host forwards it to the wallet MFE unchanged.
 */
import type {
  ApprovedIntentPrepareRequest,
  NearIntentsPrepareRequest,
  NearIntentsSwapPrepareRequest,
  NearIntentsTokenDelta,
  NearIntentsTransferPrepareRequest,
  SwapAuthMethod,
  SwapExecutionMode,
  SwapExecutionPackage,
  SwapRequiredAction,
} from '@vodis/cs-intents';

export type {
  ApprovedIntentPrepareRequest,
  NearIntentsPrepareRequest,
  NearIntentsSwapPrepareRequest,
  NearIntentsTokenDelta,
  NearIntentsTransferPrepareRequest,
  SwapAuthMethod,
  SwapExecutionMode,
  SwapExecutionPackage,
  SwapRequiredAction,
};

export type IntentPrepareProtocol = 'near-intents';
export type DefuseAuthMethod = SwapAuthMethod;
