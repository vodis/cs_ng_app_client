export const AMOUNT_DECIMAL_SEPARATOR = ',';
export const AMOUNT_THOUSAND_SEPARATOR = '.';

const AMOUNT_INPUT_CONTROL_KEYS = [
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
] as const;

const BLOCKED_AMOUNT_INPUT_KEYS = ['e', 'E', '+', '-'] as const;

export type AmountKeydownAction = 'allow' | 'block' | 'decimal-separator';

export function isAmountInputControlKey(event: KeyboardEvent): boolean {
  return (
    AMOUNT_INPUT_CONTROL_KEYS.some(controlKey => controlKey === event.key) ||
    event.ctrlKey ||
    event.metaKey
  );
}

export function isAmountDigitKey(key: string): boolean {
  return /^\d$/.test(key);
}

export function isDecimalSeparatorInputKey(event: KeyboardEvent): boolean {
  return (
    event.code === 'Comma' ||
    event.code === 'Period' ||
    event.code === 'NumpadDecimal' ||
    event.key === ',' ||
    event.key === '.'
  );
}

export function isBlockedScientificNotationKey(key: string): boolean {
  return BLOCKED_AMOUNT_INPUT_KEYS.some(blockedKey => blockedKey === key);
}

export function resolveAmountKeydownAction(
  event: KeyboardEvent
): AmountKeydownAction {
  if (isAmountInputControlKey(event)) {
    return 'allow';
  }

  if (isAmountDigitKey(event.key)) {
    return 'allow';
  }

  if (isDecimalSeparatorInputKey(event)) {
    return 'decimal-separator';
  }

  if (isBlockedScientificNotationKey(event.key)) {
    return 'block';
  }

  if (event.key.length === 1) {
    return 'block';
  }

  return 'allow';
}

export function normalizeAmountInputChars(value: string): string {
  return value
    .replace(/\s/g, '')
    .replace(/[\u201A\uFF0C\u066B]/g, AMOUNT_DECIMAL_SEPARATOR)
    .replace(/[^\d.,]/g, '');
}

export function formatWholeWithDots(whole: string): string {
  const digits = whole.replace(/\D/g, '');
  if (!digits) {
    return '0';
  }

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, AMOUNT_THOUSAND_SEPARATOR);
}

export function parseDisplayedAmount(
  value: string,
  maxFractionDigits: number
): { whole: string; fraction: string } {
  const cleaned = value.replace(/\s/g, '');
  if (!cleaned) {
    return { whole: '', fraction: '' };
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      return parseWithDecimalSeparator(cleaned, lastComma, ',');
    }

    return parseWithDecimalSeparator(cleaned, lastDot, '.');
  }

  if (lastComma !== -1) {
    return parseWithDecimalSeparator(cleaned, lastComma, ',');
  }

  if (lastDot !== -1) {
    const tail = cleaned
      .slice(lastDot + 1)
      .replace(/\./g, '')
      .replace(/\D/g, '');
    const head = cleaned.slice(0, lastDot);
    const tailIsDecimal =
      tail.length > 0 && tail.length <= maxFractionDigits && tail.length < 3;

    if (tailIsDecimal) {
      return {
        whole: stripLeadingZeros(
          stripThousands(head, AMOUNT_THOUSAND_SEPARATOR)
        ),
        fraction: tail,
      };
    }
  }

  return {
    whole: stripLeadingZeros(cleaned.replace(/\D/g, '')),
    fraction: '',
  };
}

export function displayHasDecimalSeparator(
  value: string,
  maxFractionDigits: number
): boolean {
  if (value.includes(',')) {
    return true;
  }

  return normalizeAmountStorage(value, maxFractionDigits).includes('.');
}

export function normalizeAmountStorage(
  value: string,
  maxFractionDigits: number
): string {
  const cleaned = value.replace(/\s/g, '').trim();
  if (!cleaned) {
    return '';
  }

  if (cleaned.endsWith(',') || cleaned.endsWith('.')) {
    const { whole } = parseDisplayedAmount(
      cleaned.slice(0, -1),
      maxFractionDigits
    );
    return whole ? `${whole}.` : '.';
  }

  const { whole, fraction } = parseDisplayedAmount(cleaned, maxFractionDigits);
  if (!whole && !fraction) {
    return '';
  }

  const cappedFraction = fraction.slice(0, maxFractionDigits);
  return cappedFraction ? `${whole}.${cappedFraction}` : whole;
}

export function formatSwapAmountDisplay(
  value: string,
  maxFractionDigits: number,
  allowEmpty = false
): string {
  const normalized = value.trim();
  if (!normalized) {
    return allowEmpty ? '' : `0${AMOUNT_DECIMAL_SEPARATOR}00`;
  }

  if (normalized === '.') {
    return `0${AMOUNT_DECIMAL_SEPARATOR}`;
  }

  if (normalized.endsWith('.')) {
    const wholePart = normalized.slice(0, -1);
    return `${formatWholeWithDots(wholePart || '0')}${AMOUNT_DECIMAL_SEPARATOR}`;
  }

  const dotIndex = normalized.indexOf('.');
  const wholePart =
    dotIndex === -1 ? normalized : normalized.slice(0, dotIndex);
  const fractionPart =
    dotIndex === -1
      ? ''
      : normalized.slice(dotIndex + 1).slice(0, maxFractionDigits);
  const whole = formatWholeWithDots(wholePart || '0');

  if (!fractionPart) {
    return whole;
  }

  return `${whole}${AMOUNT_DECIMAL_SEPARATOR}${fractionPart}`;
}

export function formatNumberForAmountDisplay(
  value: number,
  maxFractionDigits: number
): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const normalized = abs.toLocaleString('en-US', {
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  });

  return sign + formatSwapAmountDisplay(normalized, maxFractionDigits);
}

function parseWithDecimalSeparator(
  cleaned: string,
  separatorIndex: number,
  separator: ',' | '.'
): { whole: string; fraction: string } {
  const thousandSeparator = separator === ',' ? '.' : ',';
  const wholePart = cleaned.slice(0, separatorIndex);
  const fractionPart = cleaned.slice(separatorIndex + 1).replace(/\D/g, '');

  return {
    whole: stripLeadingZeros(stripThousands(wholePart, thousandSeparator)),
    fraction: fractionPart,
  };
}

function stripThousands(part: string, thousandSeparator: string): string {
  if (thousandSeparator === '.') {
    return part.replace(/\./g, '').replace(/\D/g, '');
  }

  return part.split(thousandSeparator).join('').replace(/\D/g, '');
}

function stripLeadingZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, '');
}
