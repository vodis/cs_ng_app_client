/**
 * Host-facing aliases for the shared intent contracts used by the wallet MFE.
 */
import type { SwapAuthMethod } from '@vodis/cs-intents';

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
} from '@vodis/cs-intents';

export type IntentPrepareProtocol = 'near-intents';
export type DefuseAuthMethod = SwapAuthMethod;
