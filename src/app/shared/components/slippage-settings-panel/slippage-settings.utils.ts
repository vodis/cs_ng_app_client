/** Basis points: 100 bps = 1%. */
export const DEFAULT_SLIPPAGE_TOLERANCE_BPS = 50;

export const SLIPPAGE_PRESET_BPS = [10, 25, 50, 100, 300] as const;

export type SlippagePresetBps = (typeof SLIPPAGE_PRESET_BPS)[number];

export const MAX_SLIPPAGE_TOLERANCE_BPS = 5_000;

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

export function parseSlippagePercentInput(raw: string): number | null {
  const trimmed = raw.trim().replace('%', '');
  if (!trimmed) {
    return null;
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent <= 0) {
    return null;
  }
  const bps = Math.round(percent * 100);
  if (bps < 1 || bps > MAX_SLIPPAGE_TOLERANCE_BPS) {
    return null;
  }
  return bps;
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
