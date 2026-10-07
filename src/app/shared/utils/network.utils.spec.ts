import {
  networkLabel,
  caipNetworkLabel,
  nearNetworkForAddress,
  recipientAddressError,
  walletBlockchain,
} from './network.utils';

describe('network utils', () => {
  it('maps connected wallet metadata to asset blockchain ids', () => {
    expect(
      walletBlockchain('0x0000000000000000000000000000000000000001', 42161)
    ).toBe('arb');
    expect(walletBlockchain('alice.near', null)).toBe('near');
    expect(walletBlockchain('a'.repeat(64), null)).toBe('near');
    expect(walletBlockchain('vodis_craftscript.tg', null)).toBe('near');
    expect(nearNetworkForAddress('vodis_craftscript.tg')).toBe('near:mainnet');
    expect(nearNetworkForAddress('alice.near')).toBe('near:mainnet');
    expect(nearNetworkForAddress('alice.testnet')).toBe('near:testnet');
    expect(networkLabel('bsc')).toBe('BNB Chain');
  });

  it('maps CAIP-2 network ids to short balance labels', () => {
    expect(caipNetworkLabel('near:mainnet')).toBe('NEAR');
    expect(caipNetworkLabel('eip155:1')).toBe('Ethereum');
    expect(caipNetworkLabel('eip155:8453')).toBe('Base');
    expect(caipNetworkLabel('solana:mainnet')).toBe('Solana');
  });

  it('validates destination addresses by network family', () => {
    expect(
      recipientAddressError('eth', '0x0000000000000000000000000000000000000001')
    ).toBe('');
    expect(
      recipientAddressError(
        'sol',
        'BYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z'
      )
    ).toBe('');
    expect(recipientAddressError('sol', '0x1234')).toBe(
      'Enter a valid Solana address.'
    );
  });

  it('fails closed for networks without an address validator', () => {
    expect(recipientAddressError('future-chain', 'future-address-123')).toBe(
      'Recipient addresses for Future-chain are not supported yet.'
    );
  });
});
