import {
  DEFAULT_LOCALE_SLUG,
  isLocaleSlug,
  languageToLocaleSlug,
  localeSlugToLanguage,
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
  });
});
