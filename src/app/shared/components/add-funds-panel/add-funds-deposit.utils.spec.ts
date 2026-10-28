import type { ExchangeToken } from '@shared/models/exchange-token.model';
import {
  buildAddFundsGroups,
  buildDemoDepositAddress,
  filterTokenGroups,
  networkOptionLabel,
  splitPopularGroups,
} from './add-funds-deposit.utils';

function token(
  partial: Pick<ExchangeToken, 'symbol' | 'assetId' | 'blockchain' | 'name'>
): ExchangeToken {
  return {
    color: '#fff',
    ...partial,
  };
}

describe('add-funds-deposit.utils', () => {
  const tokens = [
    token({
      symbol: 'USDC',
      name: 'USD Coin',
      assetId: 'usdc-eth',
      blockchain: 'eth',
    }),
    token({
      symbol: 'USDC',
      name: 'USD Coin',
      assetId: 'usdc-base',
      blockchain: 'base',
    }),
    token({
      symbol: 'AAVE',
      name: 'Aave',
      assetId: 'aave-eth',
      blockchain: 'eth',
    }),
    token({
      symbol: 'ETH',
      name: 'Ether',
      assetId: 'eth-native',
      blockchain: 'eth',
    }),
  ];

  it('groups tokens and splits popular symbols to the top', () => {
    const groups = buildAddFundsGroups(tokens);
    const { popular, rest } = splitPopularGroups(groups);

    expect(popular.map(group => group.symbol)).toEqual(['ETH', 'USDC']);
    expect(rest.map(group => group.symbol)).toEqual(['AAVE']);
    expect(popular.find(group => group.symbol === 'USDC')?.tokens.length).toBe(
      2
    );
  });

  it('filters groups by name or symbol', () => {
    const groups = buildAddFundsGroups(tokens);
    expect(filterTokenGroups(groups, 'usd').map(group => group.symbol)).toEqual(
      ['USDC']
    );
    expect(
      filterTokenGroups(groups, 'aave').map(group => group.symbol)
    ).toEqual(['AAVE']);
  });

  it('uses friendly network labels without contract ids', () => {
    expect(networkOptionLabel(tokens[0])).toBe('Ethereum');
    expect(networkOptionLabel(tokens[1])).toBe('Base');
  });

  it('builds a deterministic demo deposit address', () => {
    const first = buildDemoDepositAddress(tokens[0]);
    const second = buildDemoDepositAddress(tokens[0]);
    expect(first).toMatch(/^0x[a-f0-9]{40}$/);
    expect(first).toBe(second);
  });
});
