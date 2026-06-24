export const TOKEN_EQUIVALENT_MAX_FRACTION_DIGITS = 4;
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
  fractionDigits: number,
  minDisplayRate = TOKEN_EQUIVALENT_MIN_DISPLAY_RATE
): TokenEquivalentRateFormat {
  if (!Number.isFinite(rate) || rate <= 0) {
    return { displayRate: '—', fullRate: '—', usesCompactDisplay: false };
  }

  const cappedFractionDigits = Math.min(
    Math.max(fractionDigits, 0),
    TOKEN_EQUIVALENT_MAX_FRACTION_DIGITS
  );
  const fullRate = formatRateAtMaxPrecision(rate);
  const fixed = trimTrailingZeros(rate.toFixed(cappedFractionDigits));
  const roundedToZero =
    rate > 0 && Number.parseFloat(rate.toFixed(cappedFractionDigits)) === 0;

  if (roundedToZero || rate < minDisplayRate) {
    return {
      displayRate: `>${formatFloorLabel(minDisplayRate)}`,
      fullRate,
      usesCompactDisplay: hasMeaningfulFullRate(fullRate),
    };
  }

  return {
    displayRate: fixed,
    fullRate,
    usesCompactDisplay: fullRate !== fixed,
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

function formatRateAtMaxPrecision(rate: number): string {
  return trimTrailingZeros(rate.toFixed(TOKEN_EQUIVALENT_MAX_FRACTION_DIGITS));
}

function formatFloorLabel(minDisplayRate: number): string {
  return trimTrailingZeros(
    minDisplayRate.toFixed(TOKEN_EQUIVALENT_MAX_FRACTION_DIGITS)
  );
}

function hasMeaningfulFullRate(fullRate: string): boolean {
  return fullRate !== '—' && fullRate !== '0';
}

function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) {
    return value;
  }

  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
