import { normalizeAmountInputChars } from '@shared/utils/amount-format.utils';

/** Basis points: 100 bps = 1%. */
export const DEFAULT_SLIPPAGE_TOLERANCE_BPS = 50;

export const SLIPPAGE_PRESET_BPS = [10, 25, 50, 100, 300] as const;

export type SlippagePresetBps = (typeof SLIPPAGE_PRESET_BPS)[number];

export const MIN_SLIPPAGE_PERCENT = 0.01;
export const MAX_SLIPPAGE_PERCENT = 50;
export const MAX_SLIPPAGE_TOLERANCE_BPS = MAX_SLIPPAGE_PERCENT * 100;

export function isSlippagePresetBps(value: number): value is SlippagePresetBps {
  return (SLIPPAGE_PRESET_BPS as readonly number[]).includes(value);
}

export function formatSlippagePercentLabel(bps: number): string {
  const percent = bps / 100;
  if (Number.isInteger(percent)) {
    return `${percent}%`;
  }
  const fixed = percent.toFixed(2).replace(/\.?0+$/, '');
  return `${fixed}%`;
}

export function sanitizeSlippagePercentInput(raw: string): string {
  const cleaned = normalizeAmountInputChars(raw);
  let separator: '.' | ',' | null = null;
  let result = '';

  for (const char of cleaned) {
    if (char === '.' || char === ',') {
      if (separator !== null) {
        continue;
      }
      separator = char;
      result += char;
      continue;
    }
    result += char;
  }

  return result;
}

export function parseSlippagePercentInput(raw: string): number | null {
  const trimmed = sanitizeSlippagePercentInput(raw.trim().replace('%', ''));
  if (!trimmed) {
    return null;
  }
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) {
    return null;
  }
  const percent = Number(trimmed.replace(',', '.'));
  if (
    !Number.isFinite(percent) ||
    percent < MIN_SLIPPAGE_PERCENT ||
    percent > MAX_SLIPPAGE_PERCENT
  ) {
    return null;
  }
  return Math.round(percent * 100);
}

export function percentInputFromBps(bps: number): string {
  const percent = bps / 100;
  if (Number.isInteger(percent)) {
    return String(percent);
  }
  return percent.toFixed(2).replace(/\.?0+$/, '');
}

export function minimumReceivedAtomic(
  amountOutAtomic: string,
  slippageToleranceBps: number
): string | null {
  if (!/^\d+$/.test(amountOutAtomic)) {
    return null;
  }
  if (
    !Number.isInteger(slippageToleranceBps) ||
    slippageToleranceBps < 0 ||
    slippageToleranceBps >= 10_000
  ) {
    return null;
  }
  try {
    return (
      (BigInt(amountOutAtomic) * BigInt(10_000 - slippageToleranceBps)) /
      10_000n
    ).toString();
  } catch {
    return null;
  }
}
