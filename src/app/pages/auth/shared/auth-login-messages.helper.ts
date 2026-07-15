import type { LoginMethod } from '@core/auth/auth-session.types';

const PASSKEY_LOGIN_UNAVAILABLE_PATTERNS = [/passkey login is not enabled/i];

const PASSKEY_ACCOUNT_NOT_SETUP_PATTERNS = [
  /passkey.*not.*enabled.*(?:for|on).*user/i,
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

export const PASSKEY_LOGIN_UNAVAILABLE_MESSAGE =
  'Passkey sign-in is not available right now. Please use Google, Apple, Telegram, or email to sign in.';

export function isPasskeyLoginUnavailableError(message: string): boolean {
  return PASSKEY_LOGIN_UNAVAILABLE_PATTERNS.some(pattern =>
    pattern.test(message)
  );
}

export function isPasskeySetupRequiredError(message: string): boolean {
  if (isPasskeyLoginUnavailableError(message)) {
    return false;
  }

  return PASSKEY_ACCOUNT_NOT_SETUP_PATTERNS.some(pattern =>
    pattern.test(message)
  );
}

export function resolveLoginError(
  method: LoginMethod,
  error: unknown,
  options?: { reasonCode?: string }
): string {
  const message = error instanceof Error ? error.message : 'Login failed';

  if (method !== 'passkey') {
    return message;
  }

  if (
    options?.reasonCode === 'passkey_login_is_not_enabled' ||
    isPasskeyLoginUnavailableError(message)
  ) {
    return PASSKEY_LOGIN_UNAVAILABLE_MESSAGE;
  }

  if (isPasskeySetupRequiredError(message)) {
    return PASSKEY_SETUP_REQUIRED_MESSAGE;
  }

  return message;
}
