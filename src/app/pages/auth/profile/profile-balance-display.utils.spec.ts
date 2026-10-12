import type { WalletBalance } from '@shared/services/wallet-balances.service';
import {
  balanceQuantityFullLabel,
  compareWalletBalancesByUsd,
  formatBalanceUsdDisplay,
  formatTokenBalanceDisplay,
  isZeroWalletBalance,
} from './profile-balance-display.utils';

function balance(
  overrides: Partial<WalletBalance> & Pick<WalletBalance, 'symbol' | 'assetId'>
): WalletBalance {
  return {
    walletId: 'wallet-1',
    walletAddress: 'alice.near',
    chainType: 'near',
    network: 'near:mainnet',
    decimals: 24,
    balanceRaw: '0',
    balanceDecimal: '0',
    source: 'bff',
    fetchedAt: '2026-08-19T12:00:00Z',
    expiresAt: '2026-08-19T12:30:00Z',
    stale: false,
    ...overrides,
  };
}

describe('profile balance display utils', () => {
  it('detects zero and non-zero balances from raw values', () => {
    expect(
      isZeroWalletBalance(balance({ symbol: 'NEAR', assetId: 'near:native' }))
    ).toBeTrue();
    expect(
      isZeroWalletBalance(
        balance({
          symbol: 'NEAR',
          assetId: 'near:native',
          balanceRaw: '1',
          balanceDecimal: '0.000000000000000000000001',
        })
      )
    ).toBeFalse();
  });

  it('formats compact token amounts without rounding dust to zero', () => {
    expect(
      formatTokenBalanceDisplay(
        balance({
          symbol: 'NEAR',
          assetId: 'near:native',
          balanceRaw: '1',
          balanceDecimal: '0.0000004',
        })
      )
    ).toBe('<0.000001 NEAR');

    expect(
      formatTokenBalanceDisplay(
        balance({
          symbol: 'NEAR',
          assetId: 'near:native',
          balanceRaw: '2092885010462500000000000',
          balanceDecimal: '2.0928850104625',
        })
      )
    ).toBe('2.092885 NEAR');

    expect(
      balanceQuantityFullLabel(
        balance({
          symbol: 'NEAR',
          assetId: 'near:native',
          balanceDecimal: '2.0928850104625',
        })
      )
    ).toBe('2.0928850104625 NEAR');
  });

  it('formats USD with dust, zero, and unavailable states', () => {
    expect(formatBalanceUsdDisplay(null, { isZeroBalance: true })).toBe(
      '$0.00'
    );
    expect(formatBalanceUsdDisplay(null, { isZeroBalance: false })).toBe(
      'Price unavailable'
    );
    expect(formatBalanceUsdDisplay(0.004, { isZeroBalance: false })).toBe(
      '<$0.01'
    );
    expect(formatBalanceUsdDisplay(11.784, { isZeroBalance: false })).toBe(
      '$11.78'
    );
  });

  it('sorts priced balances ahead of unpriced, then zeros', () => {
    const near = balance({
      symbol: 'NEAR',
      assetId: 'near:native',
      balanceRaw: '1',
      balanceDecimal: '1',
    });
    const abg = balance({
      symbol: 'ABG',
      assetId: 'abg',
      balanceRaw: '1',
      balanceDecimal: '1',
    });
    const eth = balance({
      symbol: 'ETH',
      assetId: 'eth',
      balanceRaw: '0',
      balanceDecimal: '0',
    });
    const values = new Map<string, number | null>([
      [near.assetId, 11.78],
      [abg.assetId, null],
      [eth.assetId, 0],
    ]);

    const sorted = [eth, abg, near].sort((left, right) =>
      compareWalletBalancesByUsd(
        left,
        right,
        row => values.get(row.assetId) ?? null
      )
    );

    expect(sorted.map(row => row.symbol)).toEqual(['NEAR', 'ABG', 'ETH']);
  });
});
