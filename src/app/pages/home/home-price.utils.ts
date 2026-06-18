import { formatNumberForAmountDisplay } from '@shared/utils/amount-format.utils';

const FIAT_COMPACT_TIERS = [
  { threshold: 1e12, suffix: 'T' },
  { threshold: 1e9, suffix: 'B' },
  { threshold: 1e6, suffix: 'M' },
  { threshold: 1e3, suffix: 'K' },
] as const;

function formatCompactAmountDisplay(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const tier of FIAT_COMPACT_TIERS) {
    if (absValue >= tier.threshold) {
      const scaled = absValue / tier.threshold;
      const formatted = formatNumberForAmountDisplay(scaled, 2).replace(
        /,00$/,
        ''
      );
      return `${sign}$${formatted}${tier.suffix}`;
    }
  }

  return '';
}

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

export function formatSwapFiatEstimate(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return '$0';
  }

  if (!Number.isFinite(value)) {
    return '$—';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1e15) {
    return `${sign}$${value
      .toExponential(2)
      .replace('.', ',')}`;
  }

  if (absValue >= 1e9) {
    const compact = formatCompactAmountDisplay(value);
    if (compact) {
      return compact;
    }
  }

  if (absValue >= 1000) {
    return `${sign}$${formatNumberForAmountDisplay(absValue, 0)}`;
  }

  if (absValue >= 1) {
    return `${sign}$${formatNumberForAmountDisplay(absValue, 2)}`;
  }

  return `${sign}$${formatNumberForAmountDisplay(absValue, 4)}`;
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
