export const environment = {
  name: 'production',
  production: true,
  origin: 'https://craftscript.com/',
  apiUrl: 'https://api.craftscript.com',
  mfeWalletsRemoteUrl: 'https://wallets.craftscript.com',
  // Production must stay disabled until BFF recipient support is deployed and
  // foreign-recipient prepares are guaranteed to use intent_sign.
  crossNetworkRecipientIntentSignEnabled: true,
  // First-party product analytics (TelemetryGateway). Off by default; GA is unaffected.
  telemetryGateway: false,
};
