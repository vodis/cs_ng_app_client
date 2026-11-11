/// <reference types="jasmine" />

import {
  daysUntil,
  expiresWithinDays,
  investmentHorizonLabel,
  investmentObjectiveLabel,
  relativeExpiryLabel,
  riskToleranceLabel,
} from './portfolio-display.utils';

describe('portfolio-display.utils', () => {
  it('maps investment preference enums to readable labels', () => {
    expect(investmentObjectiveLabel('capital_preservation')).toBe(
      'Capital preservation'
    );
    expect(riskToleranceLabel('balanced')).toBe('Balanced');
    expect(investmentHorizonLabel('3_5y')).toBe('3–5 years');
    expect(investmentHorizonLabel(undefined)).toBe('Not set');
  });

  it('formats relative expiry and highlights the final week', () => {
    const now = Date.parse('2026-11-11T12:00:00.000Z');

    expect(relativeExpiryLabel('2026-12-11T12:00:00.000Z', now)).toBe(
      'Expires in 30 days'
    );
    expect(relativeExpiryLabel('2026-11-14T12:00:00.000Z', now)).toBe(
      'Expires in 3 days'
    );
    expect(relativeExpiryLabel('2026-11-11T18:00:00.000Z', now)).toBe(
      'Expires today'
    );
    expect(relativeExpiryLabel('2026-11-10T12:00:00.000Z', now)).toBe(
      'Expired'
    );
    expect(expiresWithinDays('2026-11-14T12:00:00.000Z', 7, now)).toBeTrue();
    expect(expiresWithinDays('2026-12-11T12:00:00.000Z', 7, now)).toBeFalse();
    expect(daysUntil('2026-11-18T12:00:00.000Z', now)).toBe(7);
    expect(daysUntil('2026-11-11T18:00:00.000Z', now)).toBe(0);
  });
});
