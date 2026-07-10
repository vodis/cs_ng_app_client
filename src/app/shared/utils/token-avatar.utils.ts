import { ExchangeToken } from '@shared/models/exchange-token.model';

export const EXCHANGE_TOKEN_ICON_URLS: Record<string, string> = {
  BTC: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1.png',
  ETH: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png',
  NEAR: 'https://s2.coinmarketcap.com/static/img/coins/128x128/6535.png',
  SOL: 'https://s2.coinmarketcap.com/static/img/coins/128x128/5426.png',
  USDC: 'https://s2.coinmarketcap.com/static/img/coins/128x128/3408.png',
  USDT: 'https://s2.coinmarketcap.com/static/img/coins/128x128/825.png',
};

export function tokenAvatarLabel(token: ExchangeToken): string {
  return token.displaySymbol?.trim() || token.symbol;
}

export function tokenAvatarFallback(label: string): string {
  if (label === 'USDC') {
    return '$';
  }

  return label[0] ?? '?';
}

export function resolveExchangeTokenIconUrl(
  token: ExchangeToken,
  fallbackUrls: Record<string, string> = EXCHANGE_TOKEN_ICON_URLS
): string {
  const directIcon = token.icon?.trim();
  if (directIcon) {
    return directIcon;
  }

  return (
    fallbackUrls[token.symbol] ??
    fallbackUrls[token.symbol.replace(/^w/i, '')] ??
    ''
  );
}

export function enrichExchangeToken(
  token: ExchangeToken,
  fallbackUrls: Record<string, string> = EXCHANGE_TOKEN_ICON_URLS
): ExchangeToken {
  const icon = resolveExchangeTokenIconUrl(token, fallbackUrls);

  return {
    ...token,
    icon: icon || token.icon,
  };
}
