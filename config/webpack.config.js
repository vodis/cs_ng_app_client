const {
  shareAll,
  withModuleFederationPlugin,
} = require('@angular-architects/module-federation/webpack');

// Remotes are registered at runtime from `environment.mfeWalletsRemoteUrl`
// via `initFederation` in `src/main.ts` (dynamic Module Federation).
const mfConfig = withModuleFederationPlugin({
  remotes: {},

  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: false,
      requiredVersion: 'auto',
    }),
  },
});

// Override MF `publicPath: 'auto'` — avoids import.meta in styles.js (Angular classic script).
module.exports = {
  ...mfConfig,
  output: {
    ...mfConfig.output,
    uniqueName: 'cs_ng_app_client',
    publicPath: '/',
  },
};
