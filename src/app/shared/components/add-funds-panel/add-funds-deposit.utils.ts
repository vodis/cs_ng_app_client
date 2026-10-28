import type { ExchangeToken } from '@shared/models/exchange-token.model';
import {
  groupTokens,
  type TokenGroup,
} from '../token-select-panel/token-groups.utils';

export type AddFundsStep = 'token' | 'network' | 'deposit';

export const ADD_FUNDS_POPULAR_SYMBOLS = [
  'BTC',
  'ETH',
  'USDC',
  'USDT',
  'NEAR',
  'SOL',
  'TON',
  'ARB',
  'AVAX',
] as const;

export function filterTokenGroups(
  groups: TokenGroup[],
  query: string
): TokenGroup[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return groups;
  }
  return groups.filter(group => {
    if (group.symbol.toLowerCase().includes(normalized)) {
      return true;
    }
    return group.tokens.some(token => {
      const name = token.name.toLowerCase();
      const symbol = (token.displaySymbol || token.symbol).toLowerCase();
      return name.includes(normalized) || symbol.includes(normalized);
    });
  });
}

export function splitPopularGroups(groups: TokenGroup[]): {
  popular: TokenGroup[];
  rest: TokenGroup[];
} {
  const popularOrder = new Map<string, number>(
    ADD_FUNDS_POPULAR_SYMBOLS.map((symbol, index) => [symbol, index])
  );
  const popular: TokenGroup[] = [];
  const rest: TokenGroup[] = [];
  for (const group of groups) {
    if (popularOrder.has(group.symbol)) {
      popular.push(group);
    } else {
      rest.push(group);
    }
  }
  popular.sort(
    (left, right) =>
      (popularOrder.get(left.symbol) ?? 0) -
      (popularOrder.get(right.symbol) ?? 0)
  );
  rest.sort((left, right) => left.symbol.localeCompare(right.symbol));
  return { popular, rest };
}

export function buildAddFundsGroups(tokens: ExchangeToken[]): TokenGroup[] {
  return groupTokens(tokens).sort((left, right) =>
    left.symbol.localeCompare(right.symbol)
  );
}

export function networkOptionLabel(token: ExchangeToken): string {
  const chain = token.blockchain.trim().toLowerCase();
  const labels: Record<string, string> = {
    eth: 'Ethereum',
    ethereum: 'Ethereum',
    base: 'Base',
    arb: 'Arbitrum',
    near: 'NEAR',
    btc: 'Bitcoin',
    bitcoin: 'Bitcoin',
    sol: 'Solana',
    solana: 'Solana',
    ton: 'TON',
    bsc: 'BNB Chain',
    pol: 'Polygon',
    op: 'Optimism',
    avax: 'Avalanche',
    gnosis: 'Gnosis',
    bera: 'Berachain',
    tron: 'Tron',
    sui: 'Sui',
    scroll: 'Scroll',
    starknet: 'Starknet',
    aptos: 'Aptos',
    cardano: 'Cardano',
    stellar: 'Stellar',
  };
  return (
    labels[chain] ??
    (chain ? chain.charAt(0).toUpperCase() + chain.slice(1) : 'Unknown network')
  );
}

/**
 * Demo deposit address only — never a live linked wallet address while the
 * flow is labeled Demo.
 */
export function buildDemoDepositAddress(token: ExchangeToken): string {
  const chain = token.blockchain.trim().toLowerCase() || 'unknown';
  const seed = `${token.assetId}:${token.symbol}`.replace(/[^a-zA-Z0-9]/g, '');
  const hex = hashToHex(seed);

  if (chain === 'near' || chain === 'nearprotocol') {
    return `demo-${hex.slice(0, 8)}.near`;
  }
  if (chain === 'sol' || chain === 'solana') {
    return `Demo${hex.slice(0, 40)}`;
  }
  if (chain === 'ton') {
    return `EQ${hex.slice(0, 46)}`;
  }
  if (chain === 'btc' || chain === 'bitcoin') {
    return `bc1q${hex.slice(0, 38)}`;
  }
  return `0x${hex.slice(0, 40)}`;
}

function hashToHex(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = hash >>> 0;
  const base = positive.toString(16).padStart(8, '0');
  return `${base}${base}${base}${base}${base}`;
}
