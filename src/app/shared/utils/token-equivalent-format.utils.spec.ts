import {
  formatTokenEquivalentLabel,
  formatTokenEquivalentRate,
  tokenEquivalentFractionDigits,
} from './token-equivalent-format.utils';

describe('token-equivalent-format.utils', () => {
  describe('tokenEquivalentFractionDigits', () => {
    it('always uses four decimal places', () => {
      expect(tokenEquivalentFractionDigits('wNEAR')).toBe(4);
      expect(tokenEquivalentFractionDigits('wBTC')).toBe(4);
      expect(tokenEquivalentFractionDigits('USDC')).toBe(4);
    });
  });

  describe('formatTokenEquivalentRate', () => {
    it('formats regular rates with fixed decimals', () => {
      expect(formatTokenEquivalentRate(45.61, 4)).toEqual({
        displayRate: '45.61',
        fullRate: '45.61',
        usesCompactDisplay: false,
      });
    });

    it('caps display precision even when a larger value is passed', () => {
      const result = formatTokenEquivalentRate(0.515335567010309248, 18);

      expect(result.displayRate).toBe('0.5153');
      expect(result.fullRate).toBe('0.5153');
      expect(result.usesCompactDisplay).toBe(false);
    });

    it('uses a floor label when fixed decimals would round to zero', () => {
      const result = formatTokenEquivalentRate(0.00001428, 4);

      expect(result.displayRate).toBe('>0.0001');
      expect(result.usesCompactDisplay).toBe(false);
      expect(result.fullRate).toBe('0');
    });

    it('keeps compact display for small but visible rates', () => {
      expect(formatTokenEquivalentRate(0.00012, 4)).toEqual({
        displayRate: '0.0001',
        fullRate: '0.0001',
        usesCompactDisplay: false,
      });
    });

    it('never shows more than four digits after the decimal point', () => {
      const result = formatTokenEquivalentRate(123.456789, 4);

      expect(result.displayRate).toBe('123.4568');
      expect(result.fullRate).toBe('123.4568');
    });
  });

  describe('formatTokenEquivalentLabel', () => {
    it('builds the chart label without hover title for tiny rounded rates', () => {
      const label = formatTokenEquivalentLabel('USDC', 'BTC', 0.00001428, 4);

      expect(label.display).toBe('1 USDC = >0.0001 BTC');
      expect(label.title).toBe('');
    });

    it('omits hover title when display already uses max precision', () => {
      const label = formatTokenEquivalentLabel(
        'USDC',
        'NEAR',
        0.515335567010309248,
        4
      );

      expect(label.display).toBe('1 USDC = 0.5153 NEAR');
      expect(label.title).toBe('');
    });
  });
});
