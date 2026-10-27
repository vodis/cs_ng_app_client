import {
  CURRENT_TERMS_VERSION,
  TERMS_ACCEPTANCE_STORAGE_KEY,
} from './terms-acceptance.constants';
import { TermsAcceptanceService } from './terms-acceptance.service';

describe('TermsAcceptanceService', () => {
  let service: TermsAcceptanceService;

  beforeEach(() => {
    window.localStorage.removeItem(TERMS_ACCEPTANCE_STORAGE_KEY);
    service = new TermsAcceptanceService();
  });

  afterEach(() => {
    window.localStorage.removeItem(TERMS_ACCEPTANCE_STORAGE_KEY);
  });

  it('treats missing acceptance as not accepted', () => {
    expect(service.hasAcceptedCurrent('user-1')).toBeFalse();
    expect(service.hasPriorAcceptance('user-1')).toBeFalse();
    expect(service.isVersionUpdate('user-1')).toBeFalse();
    expect(service.getAcceptedVersion('user-1')).toBeNull();
  });

  it('stores acceptance per user and current version', () => {
    service.acceptCurrent('user-1');

    expect(service.hasAcceptedCurrent('user-1')).toBeTrue();
    expect(service.hasPriorAcceptance('user-1')).toBeTrue();
    expect(service.isVersionUpdate('user-1')).toBeFalse();
    expect(service.getAcceptedVersion('user-1')).toBe(CURRENT_TERMS_VERSION);
    expect(service.hasAcceptedCurrent('user-2')).toBeFalse();
  });

  it('detects a version update when a prior acceptance exists', () => {
    window.localStorage.setItem(
      TERMS_ACCEPTANCE_STORAGE_KEY,
      JSON.stringify({
        'user-1': {
          version: '1970-01-01',
          acceptedAt: '1970-01-01T00:00:00.000Z',
        },
      })
    );

    expect(service.hasPriorAcceptance('user-1')).toBeTrue();
    expect(service.hasAcceptedCurrent('user-1')).toBeFalse();
    expect(service.isVersionUpdate('user-1')).toBeTrue();
  });

  it('ignores invalid storage payloads', () => {
    window.localStorage.setItem(TERMS_ACCEPTANCE_STORAGE_KEY, '{not-json');
    expect(service.hasAcceptedCurrent('user-1')).toBeFalse();

    window.localStorage.setItem(
      TERMS_ACCEPTANCE_STORAGE_KEY,
      JSON.stringify({ 'user-1': { version: 1 } })
    );
    expect(service.hasAcceptedCurrent('user-1')).toBeFalse();
  });
});
