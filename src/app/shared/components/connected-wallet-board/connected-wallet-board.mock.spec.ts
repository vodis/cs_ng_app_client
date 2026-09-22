/// <reference types="jasmine" />

import {
  findKnownEvmChain,
  getMockBalances,
  getMockTotalUsd,
  resolveConnectedEvmChainId,
} from './connected-wallet-board.mock';

describe('connected-wallet-board mock fixtures', () => {
  it('sums Ethereum mock holdings to the labeled USD total', () => {
    expect(getMockTotalUsd(getMockBalances('ethereum', 1))).toBe('$5,848.49');
  });

  it('keeps 7d sparkline series deterministic for a given token', () => {
    const first = getMockBalances('ethereum', 1)[0].sparkline7d;
    const second = getMockBalances('ethereum', 1)[0].sparkline7d;
    expect(first).toEqual(second);
    expect(first.length).toBe(168);
  });

  it('preserves arbitrary EVM chain IDs without remapping to mainnet', () => {
    expect(resolveConnectedEvmChainId(11155111)).toBe(11155111);
    expect(resolveConnectedEvmChainId(1)).toBe(1);
    expect(resolveConnectedEvmChainId(null)).toBeNull();
    expect(findKnownEvmChain(11155111)).toBeUndefined();
    expect(findKnownEvmChain(1)?.shortName).toBe('ETH');
    expect(getMockBalances('ethereum', 11155111)).toEqual([]);
  });
});
