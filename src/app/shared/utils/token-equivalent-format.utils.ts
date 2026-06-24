export const TOKEN_EQUIVALENT_MAX_FRACTION_DIGITS = 4;
export const TOKEN_EQUIVALENT_RATE_PRECISION = 18;
export const TOKEN_EQUIVALENT_MIN_DISPLAY_RATE = 0.0001;

export interface TokenEquivalentRateFormat {
  displayRate: string;
  fullRate: string;
  usesCompactDisplay: boolean;
}

export interface TokenEquivalentLabel {
  display: string;
  title: string;
}

export function tokenEquivalentFractionDigits(_symbol: string): number {
  return TOKEN_EQUIVALENT_MAX_FRACTION_DIGITS;
}

export function formatTokenEquivalentRate(
  rate: number,
  _fractionDigits: number,
  minDisplayRate = TOKEN_EQUIVALENT_MIN_DISPLAY_RATE
): TokenEquivalentRateFormat {
  if (!Number.isFinite(rate) || rate <= 0) {
    return { displayRate: '—', fullRate: '—', usesCompactDisplay: false };
  }

  const displayRate = formatRateDisplay(rate);

  if (rate < minDisplayRate) {
    const fullRate = trimFloatNoise(rate);

    return {
      displayRate: `>${formatFloorLabel(minDisplayRate)}`,
      fullRate,
      usesCompactDisplay: hasMeaningfulFullRate(fullRate),
    };
  }

  return {
    displayRate,
    fullRate: displayRate,
    usesCompactDisplay: false,
  };
}

export function formatTokenEquivalentLabel(
  fromSymbol: string,
  toSymbol: string,
  rate: number,
  fractionDigits: number
): TokenEquivalentLabel {
  const formatted = formatTokenEquivalentRate(rate, fractionDigits);
  const display = `1 ${fromSymbol} = ${formatted.displayRate} ${toSymbol}`;

  return {
    display,
    title: formatted.usesCompactDisplay
      ? `1 ${fromSymbol} = ${formatted.fullRate} ${toSymbol}`
      : '',
  };
}

function formatRateDisplay(rate: number): string {
  return capMaxFractionDigits(
    trimFloatNoise(rate),
    TOKEN_EQUIVALENT_MAX_FRACTION_DIGITS
  );
}

function trimFloatNoise(value: number): string {
  let best = value.toFixed(TOKEN_EQUIVALENT_RATE_PRECISION);

  for (
    let precision = 1;
    precision <= TOKEN_EQUIVALENT_RATE_PRECISION;
    precision++
  ) {
    const candidate = value.toFixed(precision);
    if (isApproxEqual(Number.parseFloat(candidate), value)) {
      best = candidate;
      break;
    }
  }

  return stripTrailingZeros(best);
}

function capMaxFractionDigits(value: string, maxDigits: number): string {
  if (!value.includes('.')) {
    return value;
  }

  const [integerPart, fractionPart] = value.split('.');
  if (fractionPart.length <= maxDigits) {
    return `${integerPart}.${fractionPart}`;
  }

  return `${integerPart}.${fractionPart.slice(0, maxDigits)}`;
}

function isApproxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(Number.EPSILON * Math.abs(b), 1e-12);
}

function stripTrailingZeros(value: string): string {
  if (!value.includes('.')) {
    return value;
  }

  return value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

function formatFloorLabel(minDisplayRate: number): string {
  return capMaxFractionDigits(
    trimFloatNoise(minDisplayRate),
    TOKEN_EQUIVALENT_MAX_FRACTION_DIGITS
  );
}

function hasMeaningfulFullRate(fullRate: string): boolean {
  return fullRate !== '—' && fullRate !== '0';
}
