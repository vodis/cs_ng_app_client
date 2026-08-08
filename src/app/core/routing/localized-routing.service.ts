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

function splitPathSuffix(path: string): { pathname: string; suffix: string } {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const suffixIndex = cleanPath.search(/[?#]/);

  if (suffixIndex === -1) {
    return { pathname: cleanPath, suffix: '' };
  }

  return {
    pathname: cleanPath.slice(0, suffixIndex) || '/',
    suffix: cleanPath.slice(suffixIndex),
  };
}

export function stripLocalePrefix(path: string): string {
  const { pathname, suffix } = splitPathSuffix(path);
  const [firstSegment, ...rest] = pathname.split('/').filter(Boolean);

  if (!isLocaleSlug(firstSegment)) {
    return `${pathname}${suffix}`;
  }

  const unprefixedPathname = rest.length > 0 ? `/${rest.join('/')}` : '/';
  return `${unprefixedPathname}${suffix}`;
}

export function localizedPath(path: string, locale: LocaleSlug): string {
  const unprefixedPath = stripLocalePrefix(path);

  if (unprefixedPath === '/') {
    return `/${locale}`;
  }

  if (unprefixedPath.startsWith('/?') || unprefixedPath.startsWith('/#')) {
    return `/${locale}${unprefixedPath.slice(1)}`;
  }

  return `/${locale}${unprefixedPath}`;
}

@Injectable({ providedIn: 'root' })
export class LocalizedRoutingService {
  constructor(
    private readonly router: Router,
    private readonly translations: CsTranslationsService
  ) {}

  public currentLocale(): LocaleSlug {
    const { pathname } = splitPathSuffix(this.router.url);
    const [firstSegment] = pathname.split('/').filter(Boolean);

    if (isLocaleSlug(firstSegment)) {
      return firstSegment;
    }

    return languageToLocaleSlug(this.translations.activeLanguage);
  }

  public path(path: string, locale = this.currentLocale()): string {
    return localizedPath(path, locale);
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

    return localizedPath(path, locale);
  } catch {
    return localizedPath(path, DEFAULT_LOCALE_SLUG);
  }
}
