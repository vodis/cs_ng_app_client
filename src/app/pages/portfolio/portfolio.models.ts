export type InvestmentObjective = 'growth' | 'income' | 'capital_preservation';
export type RiskTolerance = 'conservative' | 'balanced' | 'aggressive';
export type InvestmentHorizon = 'under_1y' | '1_3y' | '3_5y' | 'over_5y';

export type InvestmentProfile = {
  objective: InvestmentObjective;
  riskTolerance: RiskTolerance;
  horizon: InvestmentHorizon;
  updatedAt: string;
};

export type PortfolioPosition = {
  walletRef: string;
  chain: string;
  assetId: string;
  symbol: string;
  quantity: string;
  priceUsd: string | null;
  valueUsd: string | null;
  allocationPercent: string | null;
  priceUpdatedAt: string | null;
  balanceUpdatedAt: string;
};

export type PortfolioSnapshot = {
  asOf: string | null;
  valuationCurrency: 'USD';
  totalValue: string;
  unpricedPositionCount: number;
  positions: PortfolioPosition[];
};

export type AgentConnection = {
  id: string;
  clientName: string;
  scopes: string[];
  status: 'active' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
};

export type AgentIntegrationConfig = {
  enabled: boolean;
  mcpUrl: string;
  testedClients: string[];
  grantLifetimeDays: number;
};

/** How the authorization client identity was verified by the BFF. */
export type AgentClientVerification =
  | 'metadata_document'
  | 'first_party'
  | 'unverified';

export type AgentAuthorizationRequest = {
  id: string;
  clientName: string;
  scopes: string[];
  expiresAt: string;
  /** Display name from the client metadata document (sanitized, max 80). */
  clientHost?: string | null;
  clientUri?: string | null;
  logoUri?: string | null;
  redirectHost?: string | null;
  clientVerification?: AgentClientVerification | null;
  /** True when the redirect is a loopback CLI agent on this computer. */
  loopbackRedirect?: boolean | null;
};
