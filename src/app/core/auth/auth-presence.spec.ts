import {
  inactiveAuthActionLabel,
  inactiveAuthEmptyHint,
  inactiveAuthEmptyTitle,
  SESSION_EXPIRED_ACTION_LABEL,
} from './auth-presence';

describe('auth presence copy', () => {
  it('keeps guest CTAs on Connect wallet and expired CTAs on sign-in guidance', () => {
    expect(inactiveAuthActionLabel('guest')).toBe('Connect wallet');
    expect(inactiveAuthActionLabel('expired')).toBe(
      SESSION_EXPIRED_ACTION_LABEL
    );
    expect(inactiveAuthActionLabel('authenticated', 'Review')).toBe('Review');
  });

  it('explains empty profile and swaps for guest vs expired', () => {
    expect(inactiveAuthEmptyTitle('guest', 'swaps')).toBe(
      'Sign in to see your swaps.'
    );
    expect(inactiveAuthEmptyTitle('expired', 'swaps')).toContain(
      'Session expired'
    );
    expect(inactiveAuthEmptyTitle('expired', 'profile')).toContain(
      'Session expired'
    );
    expect(inactiveAuthEmptyHint('expired')).toContain('Refresh your session');
    expect(inactiveAuthEmptyHint('guest')).toContain('Create an account');
  });
});
