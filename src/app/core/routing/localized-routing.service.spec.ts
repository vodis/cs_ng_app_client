import {
  DEFAULT_LOCALE_SLUG,
  isLocaleSlug,
  languageToLocaleSlug,
  localizedPath,
  localeSlugToLanguage,
  LocalizedRoutingService,
  preferredLocalePath,
  preferredLocaleRedirect,
  stripLocalePrefix,
} from './localized-routing.service';

describe('localized routing helpers', () => {
  it('recognizes supported locale URL slugs', () => {
    expect(DEFAULT_LOCALE_SLUG).toBe('en');
    expect(isLocaleSlug('en')).toBeTrue();
    expect(isLocaleSlug('ua')).toBeTrue();
    expect(isLocaleSlug('pt')).toBeTrue();
    expect(isLocaleSlug('de')).toBeFalse();
  });

  it('maps URL slugs to backend language codes', () => {
    expect(localeSlugToLanguage('en')).toBe('EN');
    expect(localeSlugToLanguage('ua')).toBe('UA');
    expect(localeSlugToLanguage('pt')).toBe('PT');
  });

  it('maps backend language codes to URL slugs with English fallback', () => {
    expect(languageToLocaleSlug('EN')).toBe('en');
    expect(languageToLocaleSlug('ua')).toBe('ua');
    expect(languageToLocaleSlug('PT')).toBe('pt');
    expect(languageToLocaleSlug('DE')).toBe('en');
  });

  it('strips supported locale prefixes from app paths', () => {
    expect(stripLocalePrefix('/en')).toBe('/');
    expect(stripLocalePrefix('/ua/farm')).toBe('/farm');
    expect(stripLocalePrefix('/pt/proposals')).toBe('/proposals');
    expect(stripLocalePrefix('/farm')).toBe('/farm');
    expect(stripLocalePrefix('/en?ref=invite')).toBe('/?ref=invite');
    expect(stripLocalePrefix('/pt#top')).toBe('/#top');
    expect(stripLocalePrefix('/ua/farm?tab=owned#top')).toBe(
      '/farm?tab=owned#top'
    );
  });

  it('builds localized paths while preserving query strings and fragments', () => {
    expect(localizedPath('/en?ref=invite', 'en')).toBe('/en?ref=invite');
    expect(localizedPath('/pt#top', 'en')).toBe('/en#top');
    expect(localizedPath('/ua/farm?tab=owned#top', 'pt')).toBe(
      '/pt/farm?tab=owned#top'
    );
  });

  it('reads the current locale from URLs with query strings and fragments', () => {
    const router = { url: '/pt#top' };
    const translations = { activeLanguage: 'EN' };
    const service = new LocalizedRoutingService(
      router as never,
      translations as never
    );

    expect(service.currentLocale()).toBe('pt');

    router.url = '/ua?ref=invite';
    expect(service.currentLocale()).toBe('ua');
  });

  it('builds legacy redirects from stored language preference', () => {
    spyOn(window.localStorage, 'getItem').and.returnValue('PT');

    expect(preferredLocaleRedirect()).toBe('/pt');
    expect(preferredLocalePath('/farm')).toBe('/pt/farm');
    expect(preferredLocalePath('/ua/proposals')).toBe('/pt/proposals');
    expect(preferredLocalePath('/ua?ref=invite')).toBe('/pt?ref=invite');
  });
});
