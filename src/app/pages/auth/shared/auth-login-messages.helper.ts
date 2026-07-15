import type { LoginMethod } from '@core/auth/auth-session.types';

const PASSKEY_NOT_ENABLED_PATTERNS = [
  /passkey.*not.*enabled/i,
  /passkey.*not.*linked/i,
  /passkey.*not.*found/i,
  /passkey.*not.*registered/i,
  /passkey.*not.*set/i,
  /no passkey/i,
  /no.*passkey.*credential/i,
  /credential.*not.*found/i,
];

export const PASSKEY_SETUP_REQUIRED_MESSAGE =
  'Passkey sign-in is not set up on your account yet. Sign in with Google, Apple, or Telegram first, then enable passkey in your profile.';

export function isPasskeySetupRequiredError(message: string): boolean {
  return PASSKEY_NOT_ENABLED_PATTERNS.some(pattern => pattern.test(message));
}

export function resolveLoginError(method: LoginMethod, error: unknown): string {
  const message = error instanceof Error ? error.message : 'Login failed';

  if (method === 'passkey' && isPasskeySetupRequiredError(message)) {
    return PASSKEY_SETUP_REQUIRED_MESSAGE;
  }

  return message;
}
