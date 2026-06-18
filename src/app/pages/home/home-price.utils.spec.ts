import {
  changeClass,
  formatDifferenceLabel,
  formatPercent,
  formatPrice,
  formatSwapFiatEstimate,
} from './home-price.utils';

describe('home-price.utils', () => {
  describe('formatPrice', () => {
    it('returns unavailable when price is missing', () => {
      expect(formatPrice(undefined)).toBe('Unavailable');
    });

    it('formats regular prices with 2 decimals', () => {
      expect(formatPrice(1794.78)).toBe('$1,795');
      expect(formatPrice(2.4369)).toBe('$2.44');
    });

    it('formats sub-dollar prices with 4 decimals', () => {
      expect(formatPrice(0.123456)).toBe('$0.1235');
    });

    it('formats compact values for billions', () => {
      expect(formatPrice(3_162_148_952)).toContain('$3.16B');
    });
  });

  describe('formatSwapFiatEstimate', () => {
    it('uses comma decimals for regular values', () => {
      expect(formatSwapFiatEstimate(886.71)).toBe('$886,71');
      expect(formatSwapFiatEstimate(0.886767)).toBe('$0,8868');
    });

    it('uses neutral compact suffixes with comma decimals', () => {
      expect(formatSwapFiatEstimate(9.98e12)).toBe('$9,98T');
      expect(formatSwapFiatEstimate(99_840_000_000)).toBe('$99,84B');
      expect(formatSwapFiatEstimate(9.98e12)).not.toContain('трлн');
      expect(formatSwapFiatEstimate(99_840_000_000)).not.toContain('млрд');
    });

    it('formats thousands with dot grouping', () => {
      expect(formatSwapFiatEstimate(1250)).toBe('$1.250');
    });
  });

  describe('formatPercent', () => {
    it('formats percent with sign and 2 decimals', () => {
      expect(formatPercent(1.853)).toBe('+1.85%');
      expect(formatPercent(-1.853)).toBe('-1.85%');
    });

    it('returns fallback for undefined percent', () => {
      expect(formatPercent(undefined)).toBe('--');
    });
  });

  describe('changeClass', () => {
    it('maps percent values to change classes', () => {
      expect(changeClass(0.2)).toBe('positive');
      expect(changeClass(-0.2)).toBe('negative');
      expect(changeClass(0)).toBe('neutral');
      expect(changeClass(undefined)).toBe('neutral');
    });
  });

  describe('formatDifferenceLabel', () => {
    it('returns 0% for small spread values', () => {
      expect(formatDifferenceLabel(0.01)).toBe('0%');
      expect(formatDifferenceLabel(-0.04)).toBe('0%');
    });

    it('formats larger spread values with sign', () => {
      expect(formatDifferenceLabel(2.34)).toBe('+2.3%');
      expect(formatDifferenceLabel(-2.34)).toBe('-2.3%');
    });
  });
});
