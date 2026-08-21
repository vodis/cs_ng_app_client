import { PortfolioHoldingsComponent } from './portfolio-holdings.component';

describe('PortfolioHoldingsComponent', () => {
  it('builds a bounded allocation gradient from server percentages', () => {
    const component = new PortfolioHoldingsComponent();
    component.snapshot = {
      asOf: '2026-08-19T12:00:00Z',
      valuationCurrency: 'USD',
      totalValue: '100',
      unpricedPositionCount: 0,
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

    expect(component.allocationGradient()).toContain('#43e6a0 0% 100%');
  });
});
