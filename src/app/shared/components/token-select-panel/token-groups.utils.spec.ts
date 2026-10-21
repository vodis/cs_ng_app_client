import { summarizeHoldings, groupTokens } from './token-groups.utils';
import type { LinkedTokenHolding } from '@domains/wallet/application/linked-wallet-balances.facade';

describe('token group balances', () => {
  function holding(
    network: string,
    raw: string,
    decimals: number,
    address = 'alice'
  ): LinkedTokenHolding {
    return {
      token: {
        symbol: 'ETH',
        name: 'Ethereum',
        assetId: `eth-${network}`,
        blockchain: network,
        color: '#fff',
      },
      wallet: {
        id: address,
        address,
        providerWalletId: address,
        chainType: 'near',
        walletType: 'external',
        isPrimary: false,
      },
      network,
      balance: {
        walletId: address,
        walletAddress: address,
        network,
        chainType: 'near',
        assetId: `eth-${network}`,
        symbol: 'ETH',
        balanceRaw: raw,
        decimals,
        source: 'rpc',
        fetchedAt: '2030-01-01',
        expiresAt: '2030-01-02',
        stale: false,
      },
    };
  }
  it('adds 1 ETH on each network exactly, including differing decimals', () => {
    expect(
      summarizeHoldings(
        [
          holding('near:mainnet', '1000000', 6),
          holding('eip155:1', '1000000000000000000', 18),
        ],
        0
      )
    ).toEqual({ label: '2', incomplete: false });
  });
  it('preserves quantities above Number precision and tiny fractions', () => {
    expect(
      summarizeHoldings(
        [
          holding('near:mainnet', '9007199254740993000000000000000001', 18),
          holding('eip155:1', '1', 18),
        ],
        0
      ).label
    ).toBe('9.007.199.254.740.993,000000000000000002');
  });
  it('deduplicates aliased balance identities but includes different wallets', () => {
    const first = holding('near:mainnet', '100', 2);
    const alias = {
      ...first,
      token: { ...first.token, assetId: 'provider-alias' },
    };
    expect(
      summarizeHoldings(
        [first, alias, holding('near:mainnet', '100', 2, 'bob')],
        0
      ).label
    ).toBe('2');
  });
  it('does not turn missing, malformed or expired balances into available zero', () => {
    const missing = holding('near:mainnet', '0', 2);
    missing.balance = undefined;
    expect(summarizeHoldings([missing], 0).label).toBe('Balance unavailable');
    const invalid = holding('near:mainnet', '-1', 2);
    expect(summarizeHoldings([invalid], 0).incomplete).toBeTrue();
    expect(summarizeHoldings([holding('near:mainnet', '0', 2)], 0)).toEqual({
      label: '0',
      incomplete: false,
    });
    expect(
      summarizeHoldings(
        [holding('near:mainnet', '100', 2)],
        Date.parse('2031-01-01')
      ).incomplete
    ).toBeTrue();
  });
  it('groups display symbols without merging wrapped/native symbols', () => {
    const token = holding('near:mainnet', '1', 0).token;
    expect(
      groupTokens([
        token,
        { ...token, assetId: 'eth2' },
        { ...token, symbol: 'WETH' },
      ]).map(group => group.tokens.length)
    ).toEqual([2, 1]);
  });
});
