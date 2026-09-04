/// <reference types="jasmine" />

import {
  getMockBalances,
  getMockTotalUsd,
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
});
