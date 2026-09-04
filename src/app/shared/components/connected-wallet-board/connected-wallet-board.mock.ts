export type SupportedChainFamily = 'ethereum' | 'near' | 'ton';

export type EvmChainMock = {
  chainId: number;
  name: string;
  shortName: string;
};

export type TokenBalanceMock = {
  id: string;
  symbol: string;
  name: string;
  amount: string;
  usdValue: string;
  priceUsd: string;
  change24h: number;
  marketCap: string;
  volume24h: string;
  sparkline7d: number[];
};

type TokenBalanceMockSeed = Omit<TokenBalanceMock, 'sparkline7d'>;

export const EVM_CHAINS: EvmChainMock[] = [
  { chainId: 1, name: 'Ethereum', shortName: 'ETH' },
  { chainId: 42161, name: 'Arbitrum', shortName: 'ARB' },
  { chainId: 8453, name: 'Base', shortName: 'BASE' },
  { chainId: 137, name: 'Polygon', shortName: 'POL' },
];

const ETHEREUM_BALANCES: Record<number, TokenBalanceMockSeed[]> = {
  1: [
    {
      id: 'eth',
      symbol: 'ETH',
      name: 'Ethereum',
      amount: '1.2841',
      usdValue: '$4,218.62',
      priceUsd: '$3,285.40',
      change24h: 1.24,
      marketCap: '$395.2B',
      volume24h: '$18.4B',
    },
    {
      id: 'usdc',
      symbol: 'USDC',
      name: 'USD Coin',
      amount: '250.00',
      usdValue: '$250.00',
      priceUsd: '$1.00',
      change24h: 0.01,
      marketCap: '$34.1B',
      volume24h: '$6.2B',
    },
    {
      id: 'weth',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      amount: '0.4200',
      usdValue: '$1,379.87',
      priceUsd: '$3,285.40',
      change24h: 1.24,
      marketCap: '$8.9B',
      volume24h: '$1.1B',
    },
  ],
  42161: [
    {
      id: 'eth',
      symbol: 'ETH',
      name: 'Ethereum',
      amount: '0.5100',
      usdValue: '$1,675.55',
      priceUsd: '$3,285.40',
      change24h: 1.24,
      marketCap: '$395.2B',
      volume24h: '$18.4B',
    },
    {
      id: 'usdc',
      symbol: 'USDC',
      name: 'USD Coin',
      amount: '80.00',
      usdValue: '$80.00',
      priceUsd: '$1.00',
      change24h: 0.01,
      marketCap: '$34.1B',
      volume24h: '$6.2B',
    },
    {
      id: 'arb',
      symbol: 'ARB',
      name: 'Arbitrum',
      amount: '420.50',
      usdValue: '$189.23',
      priceUsd: '$0.45',
      change24h: -2.18,
      marketCap: '$1.8B',
      volume24h: '$214M',
    },
  ],
  8453: [
    {
      id: 'eth',
      symbol: 'ETH',
      name: 'Ethereum',
      amount: '0.2200',
      usdValue: '$722.79',
      priceUsd: '$3,285.40',
      change24h: 1.24,
      marketCap: '$395.2B',
      volume24h: '$18.4B',
    },
    {
      id: 'usdc',
      symbol: 'USDC',
      name: 'USD Coin',
      amount: '45.00',
      usdValue: '$45.00',
      priceUsd: '$1.00',
      change24h: 0.01,
      marketCap: '$34.1B',
      volume24h: '$6.2B',
    },
  ],
  137: [
    {
      id: 'pol',
      symbol: 'POL',
      name: 'Polygon',
      amount: '1,250.00',
      usdValue: '$562.50',
      priceUsd: '$0.45',
      change24h: -0.84,
      marketCap: '$4.2B',
      volume24h: '$312M',
    },
    {
      id: 'usdc',
      symbol: 'USDC',
      name: 'USD Coin',
      amount: '120.00',
      usdValue: '$120.00',
      priceUsd: '$1.00',
      change24h: 0.01,
      marketCap: '$34.1B',
      volume24h: '$6.2B',
    },
  ],
};

const NEAR_BALANCES: TokenBalanceMockSeed[] = [
  {
    id: 'near',
    symbol: 'NEAR',
    name: 'NEAR Protocol',
    amount: '84.1200',
    usdValue: '$428.99',
    priceUsd: '$5.10',
    change24h: 3.42,
    marketCap: '$6.1B',
    volume24h: '$312M',
  },
  {
    id: 'usdc.near',
    symbol: 'USDC',
    name: 'USD Coin',
    amount: '65.00',
    usdValue: '$65.00',
    priceUsd: '$1.00',
    change24h: 0.01,
    marketCap: '$34.1B',
    volume24h: '$6.2B',
  },
];

const TON_BALANCES: TokenBalanceMockSeed[] = [
  {
    id: 'ton',
    symbol: 'TON',
    name: 'Toncoin',
    amount: '32.4500',
    usdValue: '$214.17',
    priceUsd: '$6.60',
    change24h: -1.05,
    marketCap: '$16.8B',
    volume24h: '$198M',
  },
  {
    id: 'usdt.ton',
    symbol: 'USDT',
    name: 'Tether',
    amount: '40.00',
    usdValue: '$40.00',
    priceUsd: '$1.00',
    change24h: -0.02,
    marketCap: '$118B',
    volume24h: '$48.2B',
  },
];

export function mockSparkline7d(seed: number, changePercent: number): number[] {
  const points = 168;
  const weekChange =
    Math.abs(changePercent) < 0.15
      ? Math.sign(changePercent || 1) * (0.12 + (Math.abs(seed) % 8) / 100)
      : Math.sign(changePercent) * Math.max(Math.abs(changePercent) * 2.6, 3.2);

  let state = (Math.abs(seed) * 9973 + 13) % 2147483647 || 1;
  const rand = (): number => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };

  const phase = (seed % 97) / 97;
  const series: number[] = [];

  for (let i = 0; i < points; i += 1) {
    const t = i / (points - 1);
    const trend = weekChange * t;
    const swing =
      Math.sin((t + phase) * Math.PI * 2.1) * (1.8 + (seed % 5) * 0.15) +
      Math.sin((t + phase * 0.7) * Math.PI * 5.4) * 0.95 +
      Math.sin((t * 2 + phase) * Math.PI * 9.5) * 0.4;
    const noise = (rand() - 0.5) * 0.85;
    series.push(100 + trend + swing + noise);
  }

  series[0] = 100;
  series[points - 1] = 100 + weekChange;
  return series.map(value => Number(value.toFixed(4)));
}

function seedFromId(id: string): number {
  return [...id].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function withSparkline(token: TokenBalanceMockSeed): TokenBalanceMock {
  return {
    ...token,
    sparkline7d: mockSparkline7d(seedFromId(token.id), token.change24h),
  };
}

export function resolveDefaultEvmChainId(
  chainId: number | null | undefined
): number {
  if (chainId != null && EVM_CHAINS.some(chain => chain.chainId === chainId)) {
    return chainId;
  }
  return 1;
}

export function getMockBalances(
  family: SupportedChainFamily,
  evmChainId: number
): TokenBalanceMock[] {
  if (family === 'near') {
    return NEAR_BALANCES.map(withSparkline);
  }
  if (family === 'ton') {
    return TON_BALANCES.map(withSparkline);
  }
  return (ETHEREUM_BALANCES[evmChainId] ?? ETHEREUM_BALANCES[1]).map(
    withSparkline
  );
}

export function getMockTotalUsd(tokens: TokenBalanceMock[]): string {
  const sum = tokens.reduce((acc, token) => {
    const numeric = Number(token.usdValue.replace(/[$,]/g, ''));
    return acc + (Number.isFinite(numeric) ? numeric : 0);
  }, 0);
  return sum.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

export function formatChangePercent(change: number): string {
  const abs = Math.abs(change).toFixed(2);
  return `${change >= 0 ? '▲' : '▼'} ${abs}%`;
}

export function sparklineIsUp(values: number[]): boolean {
  if (values.length < 2) {
    return true;
  }
  return values[values.length - 1] >= values[0];
}
