import { build } from 'esbuild';

const development = process.argv.includes('--development');

await build({
  entryPoints: ['src/app/core/privy/privy-react-runtime.ts'],
  outfile: 'src/assets/privy-runtime.js',
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
