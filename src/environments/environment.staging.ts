export const environment = {
  name: 'staging',
  production: true,
  origin: 'https://staging-app.craftscript.com/',
  apiUrl: 'https://staging-app.craftscript.com',
  mfeWalletsRemoteUrl:
    'https://staging-wallets.craftscript.com/remoteEntry.js',
  // Keep fail-closed until the staging BFF advertises recipient support and
  // guarantees intent_sign execution for foreign-recipient routes.
  crossNetworkRecipientIntentSignEnabled: false,
};
