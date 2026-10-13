import type { WalletBalance } from '@shared/services/wallet-balances.service';
import {
  EXCHANGE_TOKEN_ICON_URLS,
  tokenAvatarFallback,
} from '@shared/utils/token-avatar.utils';

const ZERO_USD_LABEL = '$0.00';
const PRICE_UNAVAILABLE_LABEL = 'Price unavailable';
const MIN_DISPLAY_USD = 0.01;
const MAX_TOKEN_FRACTION_DIGITS = 6;
const DUST_TOKEN_LABEL = '<0.000001';

export function isZeroWalletBalance(balance: WalletBalance): boolean {
  if (balance.balanceRaw && !/^0+$/.test(balance.balanceRaw)) {
    return false;
  }
  const decimal = balanceQuantity(balance);
  return decimal === 0;
}

export function balanceQuantity(balance: WalletBalance): number {
  if (balance.balanceDecimal != null && balance.balanceDecimal !== '') {
    const parsed = Number(balance.balanceDecimal);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (balance.balanceRaw && !/^0+$/.test(balance.balanceRaw)) {
    return Number.MIN_VALUE;
  }
  return 0;
}

export function balanceQuantityFullLabel(balance: WalletBalance): string {
  const amount =
    balance.balanceDecimal && balance.balanceDecimal !== ''
      ? balance.balanceDecimal
      : balance.balanceRaw;
  return `${amount} ${balance.symbol}`;
}

export function formatTokenBalanceDisplay(balance: WalletBalance): string {
  const quantity = balanceQuantity(balance);
  if (quantity === 0) {
    return `0 ${balance.symbol}`;
  }

  const compact = quantity.toLocaleString('en-US', {
    maximumFractionDigits: MAX_TOKEN_FRACTION_DIGITS,
    minimumFractionDigits: 0,
  });
  const compactValue = Number(compact.replace(/,/g, ''));
  if (!Number.isFinite(compactValue) || compactValue === 0) {
    return `${DUST_TOKEN_LABEL} ${balance.symbol}`;
  }
  return `${compact} ${balance.symbol}`;
}

export function formatBalanceUsdDisplay(
  valueUsd: number | null,
  options: {
    isZeroBalance: boolean;
    portfolioLoading?: boolean;
  }
): string {
  if (options.isZeroBalance) {
    return ZERO_USD_LABEL;
  }
  if (valueUsd === null) {
    return options.portfolioLoading ? '…' : PRICE_UNAVAILABLE_LABEL;
  }
  if (!Number.isFinite(valueUsd)) {
    return PRICE_UNAVAILABLE_LABEL;
  }
  if (valueUsd > 0 && valueUsd < MIN_DISPLAY_USD) {
    return '<$0.01';
  }
  if (valueUsd === 0) {
    return ZERO_USD_LABEL;
  }
  return valueUsd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function balanceUsdTone(
  valueUsd: number | null,
  isZeroBalance: boolean
): 'priced' | 'unavailable' | 'zero' {
  if (isZeroBalance) return 'zero';
  if (valueUsd === null || !Number.isFinite(valueUsd)) return 'unavailable';
  return 'priced';
}

export function compareWalletBalancesByUsd(
  left: WalletBalance,
  right: WalletBalance,
  valueFor: (balance: WalletBalance) => number | null
): number {
  const leftZero = isZeroWalletBalance(left);
  const rightZero = isZeroWalletBalance(right);
  if (leftZero !== rightZero) {
    return leftZero ? 1 : -1;
  }

  const leftUsd = valueFor(left);
  const rightUsd = valueFor(right);
  const leftPriced = leftUsd !== null && Number.isFinite(leftUsd);
  const rightPriced = rightUsd !== null && Number.isFinite(rightUsd);

  if (!leftZero) {
    if (leftPriced !== rightPriced) {
      return leftPriced ? -1 : 1;
    }
    if (leftPriced && rightPriced) {
      if (rightUsd !== leftUsd) {
        return (rightUsd as number) - (leftUsd as number);
      }
    }
  }

  return left.symbol.localeCompare(right.symbol);
}

export function balanceTokenIconUrl(symbol: string): string {
  return (
    EXCHANGE_TOKEN_ICON_URLS[symbol] ??
    EXCHANGE_TOKEN_ICON_URLS[symbol.replace(/^w/i, '')] ??
    ''
  );
}

export function balanceTokenAvatarFallback(symbol: string): string {
  return tokenAvatarFallback(symbol);
}
