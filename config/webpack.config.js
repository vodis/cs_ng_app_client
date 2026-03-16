const {
  shareAll,
  withModuleFederationPlugin,
} = require('@angular-architects/module-federation/webpack');
const mfManifest = require('../src/config/mf.manifest.json');

module.exports = withModuleFederationPlugin({
  remotes: mfManifest,

  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: false,
      requiredVersion: 'auto',
    }),
  },
});
