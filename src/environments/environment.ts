export const environment = {
  name: 'development',
  production: false,
  origin: 'https://craftscript.com/',
  /* For local development, use the backend running on port 5001 */
  apiUrl: 'https://api.craftscript.com',
  // Enable only after the deployed BFF accepts recipient fields and guarantees
  // intent_sign prepares for foreign-recipient routes.
  crossNetworkRecipientIntentSignEnabled: false,
};
