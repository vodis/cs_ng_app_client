import {
  AUTH_SHELL_ROUTE_PREFIXES,
  isAuthShellRoute,
} from './auth-shell.routes';

describe('auth-shell.routes', () => {
  it('lists the auth shell route prefixes', () => {
    expect(AUTH_SHELL_ROUTE_PREFIXES).toEqual(['/login', '/register']);
  });

  it('detects auth shell routes from a pathname', () => {
    expect(isAuthShellRoute('/login')).toBeTrue();
    expect(isAuthShellRoute('/register?returnUrl=/')).toBeTrue();
    expect(isAuthShellRoute('/generate-wallet')).toBeFalse();
    expect(isAuthShellRoute('/profile')).toBeFalse();
    expect(isAuthShellRoute('//evil.example')).toBeFalse();
  });
});
