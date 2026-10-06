import { explorerUrlForToken } from './token-explorer.utils';

describe('explorerUrlForToken', () => {
  it('builds an Etherscan token URL from the contract address', () => {
    expect(
      explorerUrlForToken({
        symbol: 'USDC',
        name: 'USD Coin',
        assetId: 'nep141:eth-usdc.omft.near',
        color: '#2f8cff',
        blockchain: 'eth',
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      })
    ).toBe(
      'https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    );
  });

  it('reads an EVM address from the asset id when contract is missing', () => {
    expect(
      explorerUrlForToken({
        symbol: 'USDC',
        name: 'USD Coin',
        assetId:
          'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
        color: '#2f8cff',
        blockchain: 'eth',
      })
    ).toBe(
      'https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    );
  });

  it('falls back to the NEAR explorer host for native NEAR', () => {
    expect(
      explorerUrlForToken({
        symbol: 'NEAR',
        name: 'NEAR Protocol',
        assetId: 'near:native',
        executionAssetId: 'nep141:wrap.near',
        color: '#2fd17c',
        blockchain: 'near',
      })
    ).toBe('https://nearblocks.io/token/wrap.near');
  });
});
