const {
  shareAll,
  withModuleFederationPlugin,
} = require('@angular-architects/module-federation/webpack');
const mfManifest = require('../src/config/mf.manifest.json');

const mfConfig = withModuleFederationPlugin({
  remotes: mfManifest,

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
