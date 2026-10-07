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

  it('uses Basescan for USDC on Base instead of the Ethereum contract', () => {
    expect(
      explorerUrlForToken({
        symbol: 'USDC',
        name: 'USD Coin',
        assetId: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
        color: '#2f8cff',
        blockchain: 'base',
        contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      })
    ).toBe(
      'https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    );
  });

  it('uses Solscan for USDC on Solana', () => {
    expect(
      explorerUrlForToken({
        symbol: 'USDC',
        name: 'USD Coin',
        assetId: 'nep141:sol-usdc.omft.near',
        color: '#2f8cff',
        blockchain: 'sol',
        contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      })
    ).toBe(
      'https://solscan.io/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
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
