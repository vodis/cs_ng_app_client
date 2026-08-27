export const environment = {
  name: 'development',
  production: false,
  origin: 'https://craftscript.com/',
  /* Local NestJS BFF default: http://localhost:5003 */
  apiUrl: 'http://localhost:5003',
  /* Local wallet MFE origin; host appends /remoteEntry.js */
  mfeWalletsRemoteUrl: 'http://localhost:5002',
  // Enable only after the deployed BFF accepts recipient fields and guarantees
  // intent_sign prepares for foreign-recipient routes.
  crossNetworkRecipientIntentSignEnabled: false,
};
