import { loadManifest } from '@angular-architects/module-federation';

loadManifest('/assets/mf.manifest.json')
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
