import {
  AMOUNT_DECIMAL_SEPARATOR,
  displayHasDecimalSeparator,
  formatNumberForAmountDisplay,
  formatSwapAmountDisplay,
  formatWholeWithDots,
  normalizeAmountInputChars,
  normalizeAmountStorage,
  parseDisplayedAmount,
  resolveAmountKeydownAction,
} from './amount-format.utils';

describe('amount-format.utils', () => {
  const maxFractionDigits = 18;
  const keyEvent = (
    key: string,
    init: Omit<KeyboardEventInit, 'key'> = {}
  ): KeyboardEvent => new KeyboardEvent('keydown', { key, ...init });

  describe('resolveAmountKeydownAction', () => {
    it('allows navigation and digit keys', () => {
      expect(resolveAmountKeydownAction(keyEvent('1'))).toBe('allow');
      expect(resolveAmountKeydownAction(keyEvent('ArrowLeft'))).toBe('allow');
      expect(resolveAmountKeydownAction(keyEvent('a', { ctrlKey: true }))).toBe(
        'allow'
      );
    });

    it('routes decimal separator keys to dedicated handling', () => {
      expect(
        resolveAmountKeydownAction(keyEvent('б', { code: 'Comma' }))
      ).toBe('decimal-separator');
    });

    it('blocks scientific notation and other printable characters', () => {
      expect(resolveAmountKeydownAction(keyEvent('e'))).toBe('block');
      expect(resolveAmountKeydownAction(keyEvent('E'))).toBe('block');
      expect(resolveAmountKeydownAction(keyEvent('+'))).toBe('block');
      expect(resolveAmountKeydownAction(keyEvent('-'))).toBe('block');
      expect(resolveAmountKeydownAction(keyEvent('a'))).toBe('block');
    });
  });

  describe('normalizeAmountInputChars', () => {
    it('keeps digits and decimal separators only', () => {
      expect(normalizeAmountInputChars(' 1.250,5 ')).toBe('1.250,5');
      expect(normalizeAmountInputChars('0б,1')).toBe('0,1');
    });

    it('normalizes unicode comma variants', () => {
      expect(normalizeAmountInputChars('1\uFF0C5')).toBe('1,5');
    });
  });

  describe('formatWholeWithDots', () => {
    it('groups thousands with dots', () => {
      expect(formatWholeWithDots('10000000000')).toBe('10.000.000.000');
      expect(formatWholeWithDots('1250')).toBe('1.250');
    });
  });

  describe('formatSwapAmountDisplay', () => {
    it('formats large values with dot thousands and comma decimals', () => {
      expect(
        formatSwapAmountDisplay('10000000000.1000', maxFractionDigits)
      ).toBe('10.000.000.000,1000');
    });

    it('formats smaller fractional values', () => {
      expect(formatSwapAmountDisplay('1250.5', maxFractionDigits)).toBe(
        '1.250,5'
      );
      expect(formatSwapAmountDisplay('42.5000', 4)).toBe('42,5000');
    });

    it('keeps trailing decimal separator while typing', () => {
      expect(formatSwapAmountDisplay('0.', maxFractionDigits, true)).toBe('0,');
      expect(formatSwapAmountDisplay('1000.', maxFractionDigits, true)).toBe(
        '1.000,'
      );
    });

    it('returns empty string when allowed', () => {
      expect(formatSwapAmountDisplay('', maxFractionDigits, true)).toBe('');
    });

    it('returns default zero display when empty is not allowed', () => {
      expect(formatSwapAmountDisplay('', maxFractionDigits)).toBe('0,00');
    });

    it('supports long fractional precision for input display', () => {
      expect(
        formatSwapAmountDisplay('0.886767123456789', maxFractionDigits)
      ).toBe('0,886767123456789');
    });
  });

  describe('displayHasDecimalSeparator', () => {
    it('detects comma as an active decimal separator', () => {
      expect(displayHasDecimalSeparator('0,', maxFractionDigits)).toBe(true);
      expect(displayHasDecimalSeparator('0,1', maxFractionDigits)).toBe(true);
    });

    it('treats dot-only thousands grouping as not having a decimal separator', () => {
      expect(displayHasDecimalSeparator('1.000', maxFractionDigits)).toBe(
        false
      );
      expect(displayHasDecimalSeparator('10.000.000', maxFractionDigits)).toBe(
        false
      );
    });
  });

  describe('normalizeAmountStorage', () => {
    it('parses grouped display format into dot-decimal storage', () => {
      expect(
        normalizeAmountStorage('10.000.000.000,1000', maxFractionDigits)
      ).toBe('10000000000.1000');
    });

    it('parses comma decimal while typing', () => {
      expect(normalizeAmountStorage('0,', maxFractionDigits)).toBe('0.');
      expect(normalizeAmountStorage('0,1', maxFractionDigits)).toBe('0.1');
      expect(normalizeAmountStorage('1.250,', maxFractionDigits)).toBe('1250.');
    });

    it('accepts dot decimal input', () => {
      expect(normalizeAmountStorage('1250.5', maxFractionDigits)).toBe(
        '1250.5'
      );
    });

    it('caps fractional digits at max precision', () => {
      expect(normalizeAmountStorage('5,567891', 6)).toBe('5.567891');
      expect(normalizeAmountStorage('5,567891', 4)).toBe('5.5678');
    });

    it('round-trips storage through display format', () => {
      const storage = '886767.1234';
      const display = formatSwapAmountDisplay(storage, maxFractionDigits);
      expect(display).toBe('886.767,1234');
      expect(normalizeAmountStorage(display, maxFractionDigits)).toBe(storage);
    });
  });

  describe('parseDisplayedAmount', () => {
    it('treats dots as thousand separators when comma is present', () => {
      expect(
        parseDisplayedAmount('10.000.000.000,1000', maxFractionDigits)
      ).toEqual({
        whole: '10000000000',
        fraction: '1000',
      });
    });

    it('parses short dot-decimal input when no comma is present', () => {
      expect(parseDisplayedAmount('1250.5', maxFractionDigits)).toEqual({
        whole: '1250',
        fraction: '5',
      });
    });

    it('parses integer input with thousand dots', () => {
      expect(parseDisplayedAmount('1.250', maxFractionDigits)).toEqual({
        whole: '1250',
        fraction: '',
      });
    });
  });

  describe('formatNumberForAmountDisplay', () => {
    it('formats numeric values using amount display separators', () => {
      expect(formatNumberForAmountDisplay(886.71, 2)).toBe('886,71');
      expect(formatNumberForAmountDisplay(1_250, 0)).toBe('1.250');
    });
  });

  describe('typing flow', () => {
    it('supports entering 0,1 step by step', () => {
      let storage = normalizeAmountStorage('0', maxFractionDigits);
      expect(formatSwapAmountDisplay(storage, maxFractionDigits, true)).toBe(
        '0'
      );

      storage = normalizeAmountStorage('0,', maxFractionDigits);
      expect(storage).toBe('0.');
      expect(formatSwapAmountDisplay(storage, maxFractionDigits, true)).toBe(
        `0${AMOUNT_DECIMAL_SEPARATOR}`
      );

      storage = normalizeAmountStorage('0,1', maxFractionDigits);
      expect(storage).toBe('0.1');
      expect(formatSwapAmountDisplay(storage, maxFractionDigits, true)).toBe(
        '0,1'
      );
    });
  });
});
