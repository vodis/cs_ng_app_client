import {
  networkLabel,
  recipientAddressError,
  walletBlockchain,
} from './network.utils';

describe('network utils', () => {
  it('maps connected wallet metadata to asset blockchain ids', () => {
    expect(
      walletBlockchain('0x0000000000000000000000000000000000000001', 42161)
    ).toBe('arb');
    expect(walletBlockchain('alice.near', null)).toBe('near');
    expect(networkLabel('bsc')).toBe('BNB Chain');
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

  it('allows future API networks through safe generic validation', () => {
    expect(recipientAddressError('future-chain', 'future-address-123')).toBe(
      ''
    );
    expect(recipientAddressError('future-chain', 'bad address')).toContain(
      'cannot contain spaces'
    );
  });
});
