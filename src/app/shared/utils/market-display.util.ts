export type WalletMarketSnapshot = {
  symbol: string;
  priceUsd: number;
  change24hPercent: number;
  marketCapUsd: number;
  volume24hUsd: number;
  sparkline7d: number[];
};

export function emptyMarketSnapshot(symbol: string): WalletMarketSnapshot {
  return {
    symbol: symbol.trim().toUpperCase(),
    priceUsd: 0,
    change24hPercent: 0,
    marketCapUsd: 0,
    volume24hUsd: 0,
    sparkline7d: [0, 0],
  };
}

export function formatUsdPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '$0.00';
  }
  if (value >= 1) {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (value >= 0.01) {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '$0';
  }

  const units = [
    { limit: 1e12, suffix: 'T' },
    { limit: 1e9, suffix: 'B' },
    { limit: 1e6, suffix: 'M' },
    { limit: 1e3, suffix: 'K' },
  ];
  for (const unit of units) {
    if (value >= unit.limit) {
      const scaled = value / unit.limit;
      const fixed = Number(scaled.toFixed(1));
      const text = Number.isInteger(fixed)
        ? fixed.toFixed(0)
        : fixed.toFixed(1);
      return `$${text}${unit.suffix}`;
    }
  }

  return formatUsdPrice(value);
}

export function formatChangePercent(change: number): string {
  if (!Number.isFinite(change) || change === 0) {
    return '0.00%';
  }
  const abs = Math.abs(change).toFixed(2);
  return `${change > 0 ? '+' : '-'}${abs}%`;
}

export function marketIsUp(snapshot: WalletMarketSnapshot): boolean {
  if (snapshot.priceUsd <= 0) {
    return false;
  }
  if (snapshot.change24hPercent !== 0) {
    return snapshot.change24hPercent > 0;
  }
  const values = snapshot.sparkline7d;
  return values.length >= 2 && values[values.length - 1] > values[0];
}

export function marketIsDown(snapshot: WalletMarketSnapshot): boolean {
  if (snapshot.priceUsd <= 0) {
    return false;
  }
  if (snapshot.change24hPercent !== 0) {
    return snapshot.change24hPercent < 0;
  }
  const values = snapshot.sparkline7d;
  return values.length >= 2 && values[values.length - 1] < values[0];
}
