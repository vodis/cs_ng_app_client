import { build, context } from 'esbuild';

const development = process.argv.includes('--development');
const watch = process.argv.includes('--watch');

const runtimeAssets = [
  {
    name: 'auth-provider',
    entryPoint: 'runtime-assets/auth-provider/privy-react-runtime.ts',
    outfile: 'src/assets/auth-provider-runtime.js',
  },
];

const buildOptions = asset => ({
  entryPoints: [asset.entryPoint],
  outfile: asset.outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  minify: !development,
  sourcemap: development ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': development ? '"development"' : '"production"',
  },
});

if (watch) {
  const contexts = await Promise.all(
    runtimeAssets.map(asset => context(buildOptions(asset)))
  );
  await Promise.all(
    runtimeAssets.map((asset, index) => contexts[index].watch())
  );
  console.log(
    `Watching runtime assets: ${runtimeAssets.map(asset => asset.name).join(', ')}`
  );
} else {
  await Promise.all(runtimeAssets.map(asset => build(buildOptions(asset))));
}
