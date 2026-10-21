/** Additive walletFundingVersion 1.0.0 transaction envelope. */
export type WalletDepositTransaction = {
  from: string;
  to: string;
  value?: string;
  data?: string;
  chainId?: string;
  nearActions?: Array<
    | { type: 'Transfer'; params: { deposit: string } }
    | {
        type: 'FunctionCall';
        params: {
          methodName: string;
          args: Record<string, string | boolean>;
          gas: string;
          deposit: string;
        };
      }
  >;
  solana?: {
    expiresAt: string;
    blockhash: string;
    lastValidBlockHeight: number;
    mint?: string;
    decimals?: number;
  };
  bitcoin?: { feeRate: number };
  ton?: {
    validUntil: number;
    network: '-239' | '-3';
    messages: { address: string; amount: string; payload?: string }[];
  };
};
