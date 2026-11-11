import type {
  InvestmentHorizon,
  InvestmentObjective,
  RiskTolerance,
} from './portfolio.models';

const OBJECTIVE_LABELS: Record<InvestmentObjective, string> = {
  growth: 'Growth',
  income: 'Income',
  capital_preservation: 'Capital preservation',
};

const RISK_LABELS: Record<RiskTolerance, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

const HORIZON_LABELS: Record<InvestmentHorizon, string> = {
  under_1y: 'Under 1 year',
  '1_3y': '1–3 years',
  '3_5y': '3–5 years',
  over_5y: 'Over 5 years',
};

export function investmentObjectiveLabel(
  value: InvestmentObjective | undefined
): string {
  return value ? OBJECTIVE_LABELS[value] : 'Not set';
}

export function riskToleranceLabel(value: RiskTolerance | undefined): string {
  return value ? RISK_LABELS[value] : 'Not set';
}

export function investmentHorizonLabel(
  value: InvestmentHorizon | undefined
): string {
  return value ? HORIZON_LABELS[value] : 'Not set';
}

export function daysUntil(isoDate: string, now = Date.now()): number {
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) {
    return Number.NaN;
  }
  const diffMs = target - now;
  if (diffMs < 0) {
    return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  }
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function relativeExpiryLabel(isoDate: string, now = Date.now()): string {
  const days = daysUntil(isoDate, now);
  if (Number.isNaN(days)) {
    return 'Expiry unknown';
  }
  if (days < 0) {
    return 'Expired';
  }
  if (days === 0) {
    return 'Expires today';
  }
  if (days === 1) {
    return 'Expires in 1 day';
  }
  return `Expires in ${days} days`;
}

export function expiresWithinDays(
  isoDate: string,
  withinDays: number,
  now = Date.now()
): boolean {
  const days = daysUntil(isoDate, now);
  return !Number.isNaN(days) && days >= 0 && days < withinDays;
}
