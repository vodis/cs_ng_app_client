import type { NearIntentsSwapPrepareRequest } from '@mfe-contracts/intent-prepare.contract';
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
  amountOutAtomic: string;
  expiresAt: string;
  traceId?: string;
  quoteReference?: string;
  raw: Record<string, unknown>;
};

export type SwapQuoteRequest = {
  traceId: string;
  originAsset: string;
  destinationAsset: string;
  amount: string;
  signerId: string;
  recipient: string;
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS';
  depositType: 'ORIGIN_CHAIN' | 'INTENTS';
  refundType: 'ORIGIN_CHAIN' | 'INTENTS';
  slippageTolerance: number;
  deadline: string;
  authMethod: 'evm' | 'near';
  network?: string;
  dry: boolean;
};

export type SwapPrepareRequest = Omit<SwapQuoteRequest, 'dry'>;

type IntentSignExecutionPackage = {
  providerId: string;
  mode: 'intent_sign';
  protocol: 'near-intents';
  requiredAction: 'sign';
  payload: Record<string, unknown>;
};

type DepositAddressExecutionPackage = {
  providerId: string;
  mode: 'deposit_address';
  protocol: string;
  requiredAction: 'deposit';
  payload: Record<string, unknown>;
};

type EvmTransactionExecutionPackage = {
  providerId: string;
  mode: 'evm_transaction';
  protocol: string;
  requiredAction: 'submit_transaction';
  payload: Record<string, unknown>;
};

type ExternalRedirectExecutionPackage = {
  providerId: string;
  mode: 'external_redirect';
  protocol: string;
  requiredAction: 'redirect';
  payload: Record<string, unknown>;
};

export type ApprovedSwapExecutionPackage =
  | IntentSignExecutionPackage
  | DepositAddressExecutionPackage
  | EvmTransactionExecutionPackage
  | ExternalRedirectExecutionPackage;

export type ApprovedSwapPreparePackage = Omit<
  NearIntentsSwapPrepareRequest,
  'executionPackage'
> & {
  executionPackage: ApprovedSwapExecutionPackage;
  amountIn: string;
  amountOut: string;
  quoteExpiration: string;
  slippageTolerance: number;
};

export type SwapExecutionOutcome = {
  intentHash: string;
};

export type SwapFlowError = ApiErrorEnvelope & {
  step: SwapFlowState;
};
