import { ParamMap, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { TermsAcceptanceService } from '@core/auth/terms-acceptance.service';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';

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

export async function resolvePostAuthDestination(
  authSession: AuthSessionService,
  initialWalletCount: number,
  returnUrl: string
): Promise<string> {
  if (await hasLinkedWallets(authSession, initialWalletCount)) {
    return safeReturnUrl(returnUrl);
  }
  return '/profile';
}

/**
 * After login/register, send users through `/terms` when the current Terms
 * version is not yet accepted for this user. Preserves the final destination
 * in `returnUrl`.
 */
export async function navigateAfterAuth(options: {
  authSession: AuthSessionService;
  termsAcceptance: TermsAcceptanceService;
  router: Router;
  localizedRouting: LocalizedRoutingService;
  initialWalletCount: number;
  returnUrl: string;
}): Promise<void> {
  const destination = await resolvePostAuthDestination(
    options.authSession,
    options.initialWalletCount,
    options.returnUrl
  );
  const localizedDestination = options.localizedRouting.path(destination);
  const userId = options.authSession.session?.user.id;

  if (userId && !options.termsAcceptance.hasAcceptedCurrent(userId)) {
    const termsPath = options.localizedRouting.path('/terms');
    await options.router.navigateByUrl(
      `${termsPath}?returnUrl=${encodeURIComponent(localizedDestination)}`
    );
    return;
  }

  await options.router.navigateByUrl(localizedDestination);
}
