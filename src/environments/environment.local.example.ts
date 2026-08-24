/**
 * Copy to `environment.local.ts` (gitignored) before `pnpm start`.
 *
 *   cp src/environments/environment.local.example.ts src/environments/environment.local.ts
 *
 * Never commit private API / remote hosts in `environment.local.ts`.
 */
export const environment = {
  name: 'local',
  production: false,
  origin: 'https://craftscript.com/',
  // Examples:
  // apiUrl: 'http://localhost:5003',
  // apiUrl: 'https://your-private-staging-api.example.com',
  apiUrl: 'http://localhost:5003',
  // Examples:
  // mfeWalletsRemoteUrl: 'http://localhost:5002/remoteEntry.js',
  // mfeWalletsRemoteUrl: 'https://staging-wallets.craftscript.com/remoteEntry.js',
  mfeWalletsRemoteUrl: 'http://localhost:5002/remoteEntry.js',
  crossNetworkRecipientIntentSignEnabled: false,
};
