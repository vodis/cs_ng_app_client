import { initFederation } from '@angular-architects/module-federation';
import { WALLET_REMOTE_NAME } from './app/mfe-contracts/wallet-remote-entrypoints';
import { environment } from './environments/environment';

// Register remotes from environment; do not fetch remoteEntry at bootstrap so
// the shell still starts when the wallet MFE is down (load on demand later).
initFederation(
  {
    [WALLET_REMOTE_NAME]: environment.mfeWalletsRemoteUrl,
  },
  true
)
  .then(() => import('./bootstrap'))
  .catch(err => {
    console.error('Application bootstrap failed', err);
    renderBootstrapError();
  });

function renderBootstrapError(): void {
  const root = document.querySelector('app-root') ?? document.body;
  root.innerHTML =
    '<div style="padding:16px;color:#ef4444;font-size:14px;" role="alert">Application configuration failed to load. Please refresh the page.</div>';
}
