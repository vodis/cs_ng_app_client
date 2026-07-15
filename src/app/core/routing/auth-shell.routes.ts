export const AUTH_SHELL_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/generate-wallet',
] as const;

export function isAuthShellRoute(url: string): boolean {
  const path = url.split('?')[0].split('#')[0];
  return AUTH_SHELL_ROUTE_PREFIXES.some(prefix => path.startsWith(prefix));
}
