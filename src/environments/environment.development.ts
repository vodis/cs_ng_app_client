export const environment = {
  name: 'development',
  production: false,
  origin: 'https://craftscript.com/',
  apiUrl: 'https://api.craftscript.com',
  // Keep fail-closed until the selected development BFF advertises the
  // recipient contract and supports intent_sign execution for it.
  crossNetworkRecipientIntentSignEnabled: false,
};
