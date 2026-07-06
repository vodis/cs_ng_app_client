import { ExchangeToken } from '@shared/models/exchange-token.model';

export type TokenSelectPanelViewState = 'loading' | 'error' | 'empty' | 'ready';

export function filterTokensByQuery(
  tokens: ExchangeToken[],
  query: string
): ExchangeToken[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return tokens;
  }

  return tokens.filter(token => {
    const symbol = token.symbol.toLowerCase();
    const displaySymbol = (token.displaySymbol ?? token.symbol).toLowerCase();
    const name = token.name.toLowerCase();

    return (
      symbol.includes(normalizedQuery) ||
      displaySymbol.includes(normalizedQuery) ||
      name.includes(normalizedQuery)
    );
  });
}

export interface TokenSelectPanelViewModel {
  state: TokenSelectPanelViewState;
  statusMessage: string;
  isError: boolean;
}

export interface TokenSelectPanelViewInput {
  loading: boolean;
  loadError: string;
  availableTokenCount: number;
}

export function resolveTokenSelectPanelViewModel(
  input: TokenSelectPanelViewInput
): TokenSelectPanelViewModel {
  if (input.loading) {
    return {
      state: 'loading',
      statusMessage: 'Loading assets...',
      isError: false,
    };
  }

  if (input.loadError) {
    return {
      state: 'error',
      statusMessage: input.loadError,
      isError: true,
    };
  }

  if (input.availableTokenCount === 0) {
    return {
      state: 'empty',
      statusMessage: 'No assets available.',
      isError: false,
    };
  }

  return {
    state: 'ready',
    statusMessage: '',
    isError: false,
  };
}
