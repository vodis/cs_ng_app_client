import {
  AUTH_SHELL_ROUTE_PREFIXES,
  isAuthShellRoute,
} from './auth-shell.routes';

describe('auth-shell.routes', () => {
  it('lists the auth shell route prefixes', () => {
    expect(AUTH_SHELL_ROUTE_PREFIXES).toEqual([
      '/login',
      '/register',
      '/generate-wallet',
    ]);
  });

  it('detects auth shell routes from a pathname', () => {
    expect(isAuthShellRoute('/login')).toBeTrue();
    expect(isAuthShellRoute('/register?returnUrl=/')).toBeTrue();
    expect(isAuthShellRoute('/generate-wallet')).toBeTrue();
    expect(isAuthShellRoute('/profile')).toBeFalse();
    expect(isAuthShellRoute('//evil.example')).toBeFalse();
  });
});
