export type TelemetryEventName =
  | 'page.view'
  | 'wallet.connect'
  | 'auth.login'
  | 'account.login.passkey'
  | 'account.passkey.link'
  | 'swap.quote'
  | 'deposit.started'
  | 'withdrawal.started';

export type TelemetryStatus = 'started' | 'success' | 'failure';

/** Only these small string properties are ever sent. */
export type TelemetryProperties = Partial<
  Record<'route' | 'network' | 'wallet_type' | 'error_category', string>
>;

export type TelemetryEvent = {
  event_id: string;
  name: TelemetryEventName;
  status: TelemetryStatus;
  occurred_at: string;
  anonymous_id: string;
  properties: TelemetryProperties;
};

export type TelemetryBatch = { events: TelemetryEvent[] };
