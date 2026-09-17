import { ExchangeToken } from '@shared/models/exchange-token.model';

export interface WalletTokenOption {
  token: ExchangeToken;
  balanceLabel: string;
  stale: boolean;
}
