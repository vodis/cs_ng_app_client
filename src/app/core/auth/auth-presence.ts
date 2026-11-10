/** Host-visible auth state when a CraftScript account session is missing. */
export type AuthPresence = 'authenticated' | 'guest' | 'expired';

export const SESSION_EXPIRED_ACTION_LABEL =
  'Session expired — please sign in';

export function inactiveAuthActionLabel(
  presence: AuthPresence,
  guestLabel = 'Connect wallet'
): string {
  return presence === 'expired' ? SESSION_EXPIRED_ACTION_LABEL : guestLabel;
}

export function inactiveAuthEmptyTitle(
  presence: AuthPresence,
  topic: 'swaps' | 'profile'
): string {
  if (presence === 'expired') {
    return topic === 'swaps'
      ? 'Session expired. Sign in to see your swaps.'
      : 'Session expired. Sign in to manage your profile.';
  }

  return topic === 'swaps'
    ? 'Sign in to see your swaps.'
    : 'Sign in to manage your profile.';
}

export function inactiveAuthEmptyHint(presence: AuthPresence): string {
  return presence === 'expired'
    ? 'Refresh your session or sign in again to continue.'
    : 'Create an account or sign in to continue.';
}
