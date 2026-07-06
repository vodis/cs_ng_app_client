import {
  filterTokensByQuery,
  resolveTokenSelectPanelViewModel,
} from './token-select-panel.utils';
import { ExchangeToken } from '@shared/models/exchange-token.model';

const tokens: ExchangeToken[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    assetId: 'usdc-asset',
    color: '#2f8cff',
  },
  {
    symbol: 'NEAR',
    displaySymbol: 'NEAR',
    name: 'NEAR Protocol',
    assetId: 'near-asset',
    color: '#2fd17c',
  },
];

describe('filterTokensByQuery', () => {
  it('should return all tokens when query is empty', () => {
    expect(filterTokensByQuery(tokens, '')).toEqual(tokens);
    expect(filterTokensByQuery(tokens, '   ')).toEqual(tokens);
  });

  it('should filter tokens by symbol', () => {
    expect(filterTokensByQuery(tokens, 'near')).toEqual([tokens[1]]);
  });

  it('should filter tokens by display symbol', () => {
    expect(filterTokensByQuery(tokens, 'usdc')).toEqual([tokens[0]]);
  });

  it('should filter tokens by name', () => {
    expect(filterTokensByQuery(tokens, 'protocol')).toEqual([tokens[1]]);
  });
});

describe('resolveTokenSelectPanelViewModel', () => {
  it('should return loading state while assets are loading', () => {
    expect(
      resolveTokenSelectPanelViewModel({
        loading: true,
        loadError: '',
        availableTokenCount: 3,
      })
    ).toEqual({
      state: 'loading',
      statusMessage: 'Loading assets...',
      isError: false,
    });
  });

  it('should return error state when loadError is present', () => {
    expect(
      resolveTokenSelectPanelViewModel({
        loading: false,
        loadError: 'Failed to load assets.',
        availableTokenCount: 3,
      })
    ).toEqual({
      state: 'error',
      statusMessage: 'Failed to load assets.',
      isError: true,
    });
  });

  it('should return empty state when no tokens are available', () => {
    expect(
      resolveTokenSelectPanelViewModel({
        loading: false,
        loadError: '',
        availableTokenCount: 0,
      })
    ).toEqual({
      state: 'empty',
      statusMessage: 'No assets available.',
      isError: false,
    });
  });

  it('should return ready state when tokens are available', () => {
    expect(
      resolveTokenSelectPanelViewModel({
        loading: false,
        loadError: '',
        availableTokenCount: 2,
      })
    ).toEqual({
      state: 'ready',
      statusMessage: '',
      isError: false,
    });
  });

  it('should prioritize loading over error and empty states', () => {
    expect(
      resolveTokenSelectPanelViewModel({
        loading: true,
        loadError: 'Failed to load assets.',
        availableTokenCount: 0,
      }).state
    ).toBe('loading');
  });
});
