import { ParamMap } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';

export function safeReturnUrl(value: string | null | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/';
}

export function readReturnUrl(queryParamMap: ParamMap): string {
  return safeReturnUrl(queryParamMap.get('returnUrl'));
}

export async function hasLinkedWallets(
  authSession: AuthSessionService,
  initialCount: number
): Promise<boolean> {
  if (initialCount > 0) {
    return true;
  }

  const wallets = await authSession.reloadWallets();
  return wallets.length > 0;
}
