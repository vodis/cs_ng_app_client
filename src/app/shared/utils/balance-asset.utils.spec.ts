import { tokenBalance, hasPositiveBalance } from './balance-asset.utils';
import type { WalletBalance } from '@shared/services/wallet-balances.service';
import type { ExchangeToken } from '@shared/models/exchange-token.model';
const token: ExchangeToken = {
  assetId: 'near:native',
  symbol: 'NEAR',
  name: 'NEAR',
  blockchain: 'near',
  color: '',
};
const row: WalletBalance = {
  walletId: 'alice',
  walletAddress: 'alice.near',
  chainType: 'near',
  network: 'near:mainnet',
  assetId: 'near:native',
  symbol: 'NEAR',
  decimals: 24,
  balanceRaw: '1',
  source: 'rpc',
  fetchedAt: '',
  expiresAt: '',
  stale: false,
};
describe('canonical wallet holdings', () => {
  it('keeps native and wrapped balances distinct even with the same execution ID or symbol', () => {
    const wrapped = { ...row, assetId: 'nep141:wrap.near', balanceRaw: '2' };
    expect(
      tokenBalance(
        [wrapped, row],
        { ...token, executionAssetId: wrapped.assetId },
        row.network
      )
    ).toBe(row);
    expect(
      tokenBalance(
        [row, wrapped],
        { ...token, assetId: wrapped.assetId },
        row.network
      )
    ).toBe(wrapped);
    expect(tokenBalance([wrapped], token, row.network)).toBeUndefined();
  });
  it('matches equivalent NEP-141 representations only on the requested network', () => {
    const balance = { ...row, assetId: '1cs_v1:near:nep141:usdc.near' };
    const usdc = { ...token, assetId: 'nep141:usdc.near' };
    expect(tokenBalance([balance], usdc, row.network)).toBe(balance);
    expect(tokenBalance([balance], usdc, 'near:testnet')).toBeUndefined();
    expect(
      tokenBalance([balance], { ...usdc, blockchain: 'eth' }, row.network)
    ).toBeUndefined();
  });
  it('uses backend native balance identity for contractless ETH and TON/GRAM routes', () => {
    for (const [blockchain, network, assetId, balanceAssetId, symbol] of [
      ['eth', 'eip155:1', 'nep141:eth.omft.near', 'eip155:1/native', 'ETH'],
      [
        'ton',
        'ton:mainnet',
        'nep245:v2_1.omni.hot.tg:1117_',
        'ton:native',
        'GRAM',
      ],
    ]) {
      const balance = { ...row, network, assetId: balanceAssetId };
      const asset = { ...token, assetId, blockchain, symbol, balanceAssetId };
      expect(tokenBalance([balance], asset, network)).toBe(balance);
      expect(
        tokenBalance(
          [balance],
          { ...asset, balanceAssetId: undefined },
          network
        )
      ).toBeUndefined();
    }
  });
  it('uses raw integers for positive holdings, including dust, without trusting display amounts', () => {
    expect(hasPositiveBalance({ ...row, balanceDecimal: '0' })).toBeTrue();
    for (const balanceRaw of ['0', '000', '-1', 'NaN', '0.5'])
      expect(hasPositiveBalance({ ...row, balanceRaw })).toBeFalse();
  });
});
