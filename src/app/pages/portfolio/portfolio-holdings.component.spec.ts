import { PortfolioHoldingsComponent } from './portfolio-holdings.component';

describe('PortfolioHoldingsComponent', () => {
  it('formats priced and unpriced position values', () => {
    const component = new PortfolioHoldingsComponent();
    component.snapshot = {
      asOf: '2026-08-19T12:00:00Z',
      valuationCurrency: 'USD',
      totalValue: '100',
      unpricedPositionCount: 1,
      positions: [
        {
          walletRef: 'opaque-wallet',
          chain: 'near',
          assetId: 'near',
          symbol: 'NEAR',
          quantity: '20',
          priceUsd: '5',
          valueUsd: '100',
          allocationPercent: '100.00',
          priceUpdatedAt: '2026-08-19T12:00:00Z',
          balanceUpdatedAt: '2026-08-19T12:00:00Z',
        },
      ],
    };

    expect(component.currency('100')).toBe('$100.00');
    expect(component.currency(null)).toBe('Unpriced');
    expect(component.percent(component.snapshot.positions[0])).toBe('100.0%');
  });
});
