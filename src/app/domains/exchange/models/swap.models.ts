import type { ApprovedIntentPrepareRequest } from '@mfe-contracts/intent-prepare.contract';
import type { ApiErrorEnvelope } from '@mfe-contracts/api-envelope';

export type SwapFlowState =
  | 'idle'
  | 'validating'
  | 'requestingQuote'
  | 'awaitingUserSignature'
  | 'submittingTransaction'
  | 'confirming'
  | 'completed'
  | 'failed';

export type SwapQuotePreview = {
  amountOut: string;
  raw: Record<string, unknown>;
};

export type SwapQuoteRequest = {
  traceId: string;
  originAsset: string;
  destinationAsset: string;
  amount: string;
  userAddress: string;
  slippageTolerance: number;
  deadline: string;
  authMethod: 'evm' | 'near';
  dry: boolean;
};

export type SwapPrepareRequest = Omit<SwapQuoteRequest, 'dry'>;

export type ApprovedSwapPreparePackage = ApprovedIntentPrepareRequest & {
  executionPackage: NonNullable<
    ApprovedIntentPrepareRequest['executionPackage']
  >;
};

export type SwapExecutionOutcome = {
  intentHash: string;
};

export type SwapFlowError = ApiErrorEnvelope & {
  step: SwapFlowState;
};
