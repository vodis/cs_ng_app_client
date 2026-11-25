export const environment = {
  name: 'staging',
  production: true,
  origin: 'https://staging-app.craftscript.com/',
  apiUrl: 'https://staging-app.craftscript.com',
  mfeWalletsRemoteUrl: 'https://staging-wallets.craftscript.com',
  // Keep fail-closed until the staging BFF advertises recipient support and
  // guarantees intent_sign execution for foreign-recipient routes.
  crossNetworkRecipientIntentSignEnabled: true,
  // First-party product analytics (TelemetryGateway). Off by default; GA is unaffected.
  telemetryGateway: false,
};
