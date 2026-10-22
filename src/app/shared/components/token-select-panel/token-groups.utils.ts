import type { ExchangeToken } from '@shared/models/exchange-token.model';
import {
  holdingKey,
  type LinkedTokenHolding,
} from '@domains/wallet/application/linked-wallet-balances.facade';
import {
  atomicToDecimal,
  formatSwapAmountDisplay,
} from '@shared/utils/amount-format.utils';

export interface TokenGroup {
  symbol: string;
  token: ExchangeToken;
  tokens: ExchangeToken[];
}

export function groupTokens(tokens: ExchangeToken[]): TokenGroup[] {
  const groups = new Map<string, TokenGroup>();
  for (const token of tokens) {
    const symbol = (token.displaySymbol || token.symbol).trim();
    const group = groups.get(symbol);
    if (group) group.tokens.push(token);
    else groups.set(symbol, { symbol, token, tokens: [token] });
  }
  return [...groups.values()];
}

export function summarizeHoldings(
  holdings: LinkedTokenHolding[],
  now = Date.now()
): { label: string; incomplete: boolean } {
  const unique = new Map<string, LinkedTokenHolding>();
  for (const holding of holdings) unique.set(holdingKey(holding), holding);
  const rows = [...unique.values()];
  const valid = rows.flatMap(holding => {
    const balance = holding.balance;
    return balance &&
      /^\d+$/.test(balance.balanceRaw) &&
      Number.isInteger(balance.decimals) &&
      balance.decimals >= 0 &&
      balance.decimals <= 78
      ? [balance]
      : [];
  });
  const incomplete =
    valid.length !== rows.length ||
    valid.some(
      row =>
        row.stale ||
        !Number.isFinite(Date.parse(row.expiresAt)) ||
        Date.parse(row.expiresAt) <= now
    );
  if (!valid.length) return { label: 'Balance unavailable', incomplete: true };
  const decimals = Math.max(...valid.map(row => row.decimals));
  const raw = valid.reduce(
    (sum, row) =>
      sum + BigInt(row.balanceRaw) * 10n ** BigInt(decimals - row.decimals),
    0n
  );
  const amount = atomicToDecimal(raw.toString(), decimals);
  return {
    label: formatSwapAmountDisplay(amount, decimals),
    incomplete,
  };
}
