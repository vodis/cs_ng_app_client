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
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS';
  authMethod: 'evm' | 'near';
  slippageToleranceBps: number;
};

export type SwapReviewPrepareRequest = {
  dry: false;
  traceId: string;
  originAsset: string;
  destinationAsset: string;
  amount: string;
  signerId: string;
  recipient: string;
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS';
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

export type SwapReviewServices = {
  prepareSwap: (
    request: SwapReviewPrepareRequest,
    options: { signal: AbortSignal }
  ) => Promise<SwapReviewPrepareResult>;
  signSwap: (input: {
    traceId: string;
    prepareRequest: ApprovedIntentPrepareRequest;
  }) => Promise<Record<string, unknown>>;
  submitSwap: (
    request: SwapReviewSubmitRequest
  ) => Promise<{ intentHash: string }>;
};
