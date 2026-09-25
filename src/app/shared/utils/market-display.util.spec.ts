import {
  emptyMarketSnapshot,
  formatChangePercent,
  formatCompactUsd,
  formatUsdPrice,
  marketIsDown,
  marketIsUp,
} from './market-display.util';

describe('market display', () => {
  it('formats live market figures', () => {
    expect(formatUsdPrice(5.1)).toBe('$5.10');
    expect(formatUsdPrice(0.005114)).toBe('$0.005114');
    expect(formatCompactUsd(6_100_000_000)).toBe('$6.1B');
    expect(formatCompactUsd(312_000_000)).toBe('$312M');
    expect(formatChangePercent(3.42)).toBe('+3.42%');
    expect(formatChangePercent(-1.3)).toBe('-1.30%');
  });

  it('treats missing market data as zero', () => {
    expect(emptyMarketSnapshot('near')).toEqual({
      symbol: 'NEAR',
      priceUsd: 0,
      change24hPercent: 0,
      marketCapUsd: 0,
      volume24hUsd: 0,
      sparkline7d: [0, 0],
    });
    expect(formatUsdPrice(0)).toBe('$0.00');
    expect(formatCompactUsd(0)).toBe('$0');
    expect(formatChangePercent(0)).toBe('0.00%');
    expect(marketIsUp(emptyMarketSnapshot('NEAR'))).toBeFalse();
    expect(marketIsDown(emptyMarketSnapshot('NEAR'))).toBeFalse();
  });
});
