import type { ApprovedIntentPrepareRequest } from './intent-prepare.contract';

export type SwapReviewToken = {
  assetId: string;
  executionAssetId: string;
  symbol: string;
  name: string;
  icon?: string;
  decimals: number;
};

export type SwapReviewIntent = {
  contractVersion: '1.0.0';
  traceId: string;
  source: SwapReviewToken & {
    amountAtomic: string;
    amountDisplay: string;
    fiatValue?: string;
  };
  destination: SwapReviewToken;
  preview: {
    amountOutAtomic: string;
    amountOutDisplay: string;
    fiatValue?: string;
    expiresAt: string;
    rate?: string;
    minimumReceived?: string;
    priceImpact?: string;
    networkFee?: string;
    route?: string;
    quoteReference?: string;
  };
  signer: {
    account: string;
    chainType: 'ethereum' | 'near' | 'ton';
  };
  network: { id: string; label: string };
  recipient: string;
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  depositType: 'ORIGIN_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  refundType: 'ORIGIN_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  authMethod: 'evm' | 'near';
  slippageToleranceBps: number;
};

export type SwapReviewPrepareRequest = {
  providerId: 'one-click';
  dry: false;
  traceId: string;
  originAsset: string;
  destinationAsset: string;
  amount: string;
  signerId: string;
  recipient: string;
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  depositType: 'ORIGIN_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  refundType: 'ORIGIN_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  authMethod: 'evm' | 'near';
  slippageTolerance: number;
  deadline: string;
};

export type SwapReviewPrepareResult = {
  prepareRequest: ApprovedIntentPrepareRequest;
  providerId: string;
  executionMode: string;
  amountIn: string;
  amountOut: string;
  quoteExpiration: string;
  route?: string;
  priceImpact?: string;
  networkFee?: string;
};

export type SwapReviewSubmitRequest = {
  traceId: string;
  providerId: string;
  executionMode?: string;
  executionPayload?: Record<string, unknown>;
  quoteHashes: string[];
  signature: Record<string, unknown>;
  userAddress: string;
  userChainType: 'evm' | 'near';
};

export type SwapReviewDepositRequest = {
  traceId: string;
  sourceAssetId: string;
  senderAccount: string;
  depositAddress: string;
  amount: string;
};

export type SwapStatus =
  | 'KNOWN_DEPOSIT_TX'
  | 'PENDING_DEPOSIT'
  | 'INCOMPLETE_DEPOSIT'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'REFUNDED'
  | 'FAILED';

export type SwapReviewServices = {
  quoteSwap?: (
    request: SwapReviewQuoteRequest,
    options: { signal: AbortSignal }
  ) => Promise<WalletSwapQuote>;
  prepareSwap: (
    request: SwapReviewPrepareRequest,
    options: { signal: AbortSignal }
  ) => Promise<SwapReviewPrepareResult>;
  signSwap: (input: {
    traceId: string;
    prepareRequest: ApprovedIntentPrepareRequest;
  }) => Promise<Record<string, unknown>>;
  depositSwap: (
    request: SwapReviewDepositRequest
  ) => Promise<{ transactionHash: string }>;
  submitSwap: (
    request: SwapReviewSubmitRequest
  ) => Promise<{ intentHash: string }>;
  checkSwapStatus?: (preparationId: string) => Promise<SwapStatus>;
};

/** Product choices only. Provider routing and signing parameters belong to the MFE. */
export type WalletSwapInput = {
  source: SwapReviewToken;
  destination: SwapReviewToken;
  amount: string;
  account: string;
  recipient: string;
  network: { id: string; label: string };
  slippageToleranceBps: number;
  confidential: boolean;
};

export type WalletSwapQuote = {
  amountOut: string;
  amountOutAtomic: string;
  expiresAt: string;
  traceId?: string;
  quoteReference?: string;
  raw: Record<string, unknown>;
  action?: { supported: boolean; label: string; description: string };
};

export type WalletSwapReview = {
  contractVersion: '2.0.0';
  traceId: string;
  input: WalletSwapInput;
  sourceDisplay: { amountDisplay: string; fiatValue?: string };
  preview: SwapReviewIntent['preview'];
};

export type WalletSwapQuoteOptions = { traceId: string; signal: AbortSignal };
export type SwapReviewQuoteRequest = Omit<SwapReviewPrepareRequest, 'dry'> & {
  dry: true;
};

export type SwapSettlementResult = {
  traceId: string;
  status: 'SUCCESS' | 'REFUNDED' | 'FAILED' | 'INCOMPLETE_DEPOSIT';
};
