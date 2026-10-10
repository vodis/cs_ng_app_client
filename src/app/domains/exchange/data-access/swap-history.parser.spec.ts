import { parseSwapHistory } from './swap-history.parser';
describe('swap history response boundary', () => {
  const row = {
    preparationId: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-10-10T00:00:00Z',
    status: 'UNKNOWN',
    sourceSymbol: 'NEAR',
    destinationSymbol: 'USDC',
    sourceDecimals: 24,
    destinationDecimals: 6,
    amountIn: '1000000000000000000000000',
    amountOut: '1000000',
    network: 'near:mainnet',
    destinationNetwork: 'near',
    recipient: 'alice.near',
  };
  it('keeps quote amounts distinct from actual receipts and rejects unsafe receipt links', () => {
    expect(
      parseSwapHistory({ data: { items: [row], nextCursor: null } }).data
        .items[0].receipt
    ).toBeUndefined();
    expect(() =>
      parseSwapHistory({
        data: {
          items: [
            {
              ...row,
              receipt: {
                transactions: [
                  { hash: 'tx', explorerUrl: 'javascript:alert(1)' },
                ],
              },
            },
          ],
          nextCursor: null,
        },
      })
    ).toThrow();
  });
  it('rejects invalid amounts, decimals and states instead of displaying invented values', () => {
    for (const override of [
      { amountOut: '-1' },
      { sourceDecimals: 1000 },
      { status: 'MAGIC_SUCCESS' },
    ])
      expect(() =>
        parseSwapHistory({
          data: { items: [{ ...row, ...override }], nextCursor: null },
        })
      ).toThrow();
  });
});
