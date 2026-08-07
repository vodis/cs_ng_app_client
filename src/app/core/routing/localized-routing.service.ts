import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import {
  CsLanguageCode,
  CsTranslationsService,
} from '@vodis/cs-foundation/angular';
import { firstValueFrom } from 'rxjs';

export const DEFAULT_LOCALE_SLUG = 'en';
export const LOCALE_SLUGS = ['en', 'ua', 'pt'] as const;

export type LocaleSlug = (typeof LOCALE_SLUGS)[number];

export function isLocaleSlug(
  value: string | null | undefined
): value is LocaleSlug {
  return LOCALE_SLUGS.some(locale => locale === value);
}

export function localeSlugToLanguage(locale: LocaleSlug): CsLanguageCode {
  return locale.toUpperCase();
}

export function languageToLocaleSlug(language: string): LocaleSlug {
  const locale = language.toLowerCase();
  return isLocaleSlug(locale) ? locale : DEFAULT_LOCALE_SLUG;
}

export function stripLocalePrefix(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const [firstSegment, ...rest] = cleanPath.split('/').filter(Boolean);

  if (!isLocaleSlug(firstSegment)) {
    return cleanPath;
  }

  return rest.length > 0 ? `/${rest.join('/')}` : '/';
}

@Injectable({ providedIn: 'root' })
export class LocalizedRoutingService {
  constructor(
    private readonly router: Router,
    private readonly translations: CsTranslationsService
  ) {}

  public currentLocale(): LocaleSlug {
    const [firstSegment] = this.router.url
      .split('?')[0]
      .split('/')
      .filter(Boolean);

    if (isLocaleSlug(firstSegment)) {
      return firstSegment;
    }

    return languageToLocaleSlug(this.translations.activeLanguage);
  }

  public path(path: string, locale = this.currentLocale()): string {
    const unprefixedPath = stripLocalePrefix(path);
    return unprefixedPath === '/'
      ? `/${locale}`
      : `/${locale}${unprefixedPath}`;
  }

  public navigateByUrl(path: string): Promise<boolean> {
    return this.router.navigateByUrl(this.path(path));
  }
}

export const localeRouteGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot
): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const translations = inject(CsTranslationsService);
  const locale = route.paramMap.get('locale');

  if (!isLocaleSlug(locale)) {
    return router.parseUrl(`/${DEFAULT_LOCALE_SLUG}`);
  }

  const language = localeSlugToLanguage(locale);

  if (translations.activeLanguage !== language) {
    await firstValueFrom(translations.loadLanguage(language)).catch(
      () => undefined
    );
  }

  return true;
};

export function preferredLocaleRedirect(): string {
  return preferredLocalePath('/');
}

export function preferredLocalePath(path: string): string {
  try {
    const storedLanguage = window.localStorage.getItem('active-language');
    const locale = languageToLocaleSlug(storedLanguage ?? '');
    const unprefixedPath = stripLocalePrefix(path);

    return unprefixedPath === '/'
      ? `/${locale}`
      : `/${locale}${unprefixedPath}`;
  } catch {
    const unprefixedPath = stripLocalePrefix(path);

    return unprefixedPath === '/'
      ? `/${DEFAULT_LOCALE_SLUG}`
      : `/${DEFAULT_LOCALE_SLUG}${unprefixedPath}`;
  }
}
