export function formatPrice(value: number | undefined): string {
  if (value === undefined) {
    return 'Unavailable';
  }

  if (!Number.isFinite(value)) {
    return '$—';
  }

  const absValue = Math.abs(value);

  if (absValue >= 1e15) {
    return `$${value.toExponential(2)}`;
  }

  if (absValue >= 1e9) {
    return `$${value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      notation: 'compact',
      compactDisplay: 'short',
    })}`;
  }

  if (absValue >= 1000) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  if (absValue >= 1) {
    return `$${value.toFixed(2)}`;
  }

  return `$${value.toFixed(4)}`;
}

/** Decimal multiplication and cent rounding; token quantities never pass through Number. */
export function formatSwapFiatEstimate(
  price: string | number | undefined,
  amount = '1'
): string {
  if (
    price === undefined ||
    !/^(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(String(price)) ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0 ||
    !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)
  )
    return '—';
  const [mantissa, exponent = '0'] = price.toString().toLowerCase().split('e');
  if (Math.abs(Number(exponent)) > 324) return '—';
  const [priceWhole, priceFraction = ''] = mantissa.split('.');
  const [whole, fraction = ''] = amount.split('.');
  const coefficient =
    BigInt(priceWhole + priceFraction) * BigInt(whole + fraction);
  const scale = priceFraction.length + fraction.length - Number(exponent);
  const divisor = 10n ** BigInt(Math.max(0, scale));
  const value = coefficient * 10n ** BigInt(Math.max(0, -scale));
  if (value > 0n && value * 100n < divisor) return '<$0.01';
  const cents = (value * 100n + divisor / 2n) / divisor;
  const dollars = (cents / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${dollars}.${(cents % 100n).toString().padStart(2, '0')}`;
}

export function formatPercent(value: number | undefined): string {
  if (value === undefined) {
    return '--';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function changeClass(value: number | undefined): string {
  if (value === undefined || value === 0) {
    return 'neutral';
  }

  return value > 0 ? 'positive' : 'negative';
}

export function formatDifferenceLabel(value: number): string {
  const absValue = Math.abs(value);
  if (absValue < 0.05) {
    return '0%';
  }

  return `${value >= 0 ? '+' : ''}${value.toLocaleString(undefined, {
    maximumFractionDigits: absValue >= 100 ? 0 : 1,
    minimumFractionDigits: absValue >= 100 ? 0 : 1,
  })}%`;
}

/** An unavailable or expired asset price must not look like a current USD valuation. */
export function isFreshAssetPrice(
  updatedAt: string | undefined,
  now = Date.now()
): boolean {
  const timestamp = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  return (
    Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= 300_000
  );
}
