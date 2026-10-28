import {
  DepositInstructions,
  usableDepositInstructions,
} from './deposit-instructions';

describe('deposit instructions', () => {
  const now = Date.parse('2026-10-28T12:00:00Z');
  const valid: DepositInstructions = {
    amount: '1',
    minimumReceived: '0.9',
    assetId: 'usdc-base',
    address: 'receiver-address',
    expiresAt: '2026-10-28T12:10:00Z',
  };

  it('accepts only matching, unexpired instructions', () => {
    expect(usableDepositInstructions(valid, 'usdc-base', now)).toBeTrue();
    expect(usableDepositInstructions(valid, 'usdc-eth', now)).toBeFalse();
    expect(usableDepositInstructions(null, 'usdc-base', now)).toBeFalse();
    expect(
      usableDepositInstructions(valid, 'usdc-base', now + 600000)
    ).toBeFalse();
  });

  it('rejects empty addresses, invalid expiry and blank routing memos', () => {
    for (const override of [
      { address: '' },
      { address: ' receiver' },
      { address: 'two words' },
      { expiresAt: 'invalid' },
      { memo: '' },
      { memo: ' ' },
    ]) {
      expect(
        usableDepositInstructions({ ...valid, ...override }, 'usdc-base', now)
      ).toBeFalse();
    }
  });
});
