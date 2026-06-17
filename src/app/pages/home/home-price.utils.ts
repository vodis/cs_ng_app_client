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
