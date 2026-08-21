import { ExchangeToken } from '@shared/models/exchange-token.model';
import {
  enrichExchangeToken,
  resolveExchangeTokenIconUrl,
  tokenAvatarFallback,
} from './token-avatar.utils';

describe('tokenAvatarUtils', () => {
  const token: ExchangeToken = {
    symbol: '$WIF',
    displaySymbol: '$WIF',
    name: 'dogwifhat',
    assetId: 'nep141:wif',
    color: 'hsl(280 58% 46%)',
    blockchain: 'sol',
  };

  it('should keep the API icon when present', () => {
    const withIcon: ExchangeToken = {
      ...token,
      icon: 'https://example.com/wif.png',
    };

    expect(resolveExchangeTokenIconUrl(withIcon)).toBe(
      'https://example.com/wif.png'
    );
  });

  it('should enrich known symbols with fallback icon urls', () => {
    const usdc: ExchangeToken = {
      symbol: 'USDC',
      name: 'USD Coin',
      assetId: 'nep141:usdc',
      color: '#2f8cff',
      blockchain: 'eth',
    };

    expect(enrichExchangeToken(usdc).icon).toContain('coinmarketcap.com');
  });

  it('should use the same fallback letter rules in list and swap', () => {
    expect(tokenAvatarFallback('$WIF')).toBe('$');
    expect(tokenAvatarFallback('USDC')).toBe('$');
    expect(tokenAvatarFallback('NEAR')).toBe('N');
  });
});
