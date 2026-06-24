import {
  formatTokenEquivalentLabel,
  formatTokenEquivalentRate,
  tokenEquivalentFractionDigits,
} from './token-equivalent-format.utils';

describe('token-equivalent-format.utils', () => {
  describe('tokenEquivalentFractionDigits', () => {
    it('uses the maximum display precision', () => {
      expect(tokenEquivalentFractionDigits('wNEAR')).toBe(4);
      expect(tokenEquivalentFractionDigits('wBTC')).toBe(4);
      expect(tokenEquivalentFractionDigits('USDC')).toBe(4);
    });
  });

  describe('formatTokenEquivalentRate', () => {
    it('keeps short fractional rates without padding zeros', () => {
      expect(formatTokenEquivalentRate(0.518, 4)).toEqual({
        displayRate: '0.518',
        fullRate: '0.518',
        usesCompactDisplay: false,
      });
    });

    it('truncates extra precision to four decimals without rounding', () => {
      expect(formatTokenEquivalentRate(0.51599, 18)).toEqual({
        displayRate: '0.5159',
        fullRate: '0.5159',
        usesCompactDisplay: false,
      });
    });

    it('uses a floor label for tiny rates', () => {
      const result = formatTokenEquivalentRate(0.00001428, 4);

      expect(result.displayRate).toBe('>0.0001');
      expect(result.usesCompactDisplay).toBe(true);
      expect(result.fullRate).toBe('0.00001428');
    });

    it('keeps naturally shorter whole-number rates as-is', () => {
      expect(formatTokenEquivalentRate(45.61, 4)).toEqual({
        displayRate: '45.61',
        fullRate: '45.61',
        usesCompactDisplay: false,
      });
    });

    it('does not round long rates down to four decimals', () => {
      const result = formatTokenEquivalentRate(123.456789, 4);

      expect(result.displayRate).toBe('123.4567');
      expect(result.fullRate).toBe('123.4567');
    });
  });

  describe('formatTokenEquivalentLabel', () => {
    it('builds the chart label and hover title for tiny rates', () => {
      const label = formatTokenEquivalentLabel('USDC', 'BTC', 0.00001428, 4);

      expect(label.display).toBe('1 USDC = >0.0001 BTC');
      expect(label.title).toBe('1 USDC = 0.00001428 BTC');
    });

    it('keeps shorter rates in the label without padding zeros', () => {
      const label = formatTokenEquivalentLabel('USDC', 'NEAR', 0.518, 4);

      expect(label.display).toBe('1 USDC = 0.518 NEAR');
      expect(label.title).toBe('');
    });
  });
});
