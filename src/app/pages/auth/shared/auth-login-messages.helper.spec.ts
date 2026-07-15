import {
  isPasskeyLoginUnavailableError,
  isPasskeySetupRequiredError,
  PASSKEY_LOGIN_UNAVAILABLE_MESSAGE,
  PASSKEY_SETUP_REQUIRED_MESSAGE,
  resolveLoginError,
} from './auth-login-messages.helper';

describe('auth-login-messages.helper', () => {
  it('detects passkey setup errors', () => {
    expect(
      isPasskeySetupRequiredError('No passkey credentials found')
    ).toBeTrue();
    expect(isPasskeySetupRequiredError('Login failed')).toBeFalse();
  });

  it('does not treat provider capability errors as account setup errors', () => {
    expect(
      isPasskeyLoginUnavailableError('Passkey login is not enabled.')
    ).toBeTrue();
    expect(
      isPasskeySetupRequiredError('Passkey login is not enabled.')
    ).toBeFalse();
  });

  it('maps passkey setup errors to a profile-first message', () => {
    expect(
      resolveLoginError('passkey', new Error('Passkey not enabled for user'))
    ).toBe(PASSKEY_SETUP_REQUIRED_MESSAGE);
  });

  it('maps passkey login capability errors to an availability message', () => {
    expect(
      resolveLoginError('passkey', new Error('Passkey login is not enabled.'))
    ).toBe(PASSKEY_LOGIN_UNAVAILABLE_MESSAGE);
    expect(
      resolveLoginError('passkey', new Error('Login failed'), {
        reasonCode: 'passkey_login_is_not_enabled',
      })
    ).toBe(PASSKEY_LOGIN_UNAVAILABLE_MESSAGE);
  });

  it('keeps generic login errors unchanged', () => {
    expect(resolveLoginError('google', new Error('Provider unavailable'))).toBe(
      'Provider unavailable'
    );
  });

  it('falls back when the caught value is not an Error', () => {
    expect(resolveLoginError('passkey', 'string error')).toBe('Login failed');
    expect(resolveLoginError('google', { code: 'auth_failed' })).toBe(
      'Login failed'
    );
  });

  it('keeps unrelated passkey provider errors unchanged', () => {
    expect(
      resolveLoginError('passkey', new Error('Provider unavailable'))
    ).toBe('Provider unavailable');
  });
});
