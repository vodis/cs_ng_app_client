import type { SwapStatus } from '@mfe-contracts/swap-review.types';
export type SwapHistoryItem = {
  receipt?: {
    amountIn?: string;
    amountOut?: string;
    refundedAmount?: string;
    transactions: { hash: string; explorerUrl: string }[];
  };
  preparationId: string;
  createdAt: string;
  status:
    | SwapStatus
    | 'UNKNOWN'
    | 'AWAITING_APPROVAL'
    | 'SUBMITTED'
    | 'CANCELLED';
  sourceSymbol: string;
  destinationSymbol: string;
  sourceDecimals: number;
  destinationDecimals: number;
  amountIn: string;
  amountOut: string;
  network: string;
  destinationNetwork: string;
  recipient: string;
};
