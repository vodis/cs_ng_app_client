import { InjectionToken } from '@angular/core';
import type {
  CraftscriptPrivyBridge,
  PublicAuthConfig,
  PrivyRuntimeFactory,
  PrivyRuntimeHandle,
} from './privy-bridge.types';

export type PrivyRuntimeMounter = (
  config: PublicAuthConfig,
  onReady: (bridge: CraftscriptPrivyBridge) => void
) => Promise<PrivyRuntimeHandle>;

const PRIVY_RUNTIME_SCRIPT_URL = '/assets/auth-provider-runtime.js';
let runtimeFactoryPromise: Promise<PrivyRuntimeFactory> | undefined;

function loadPrivyRuntimeFactory(): Promise<PrivyRuntimeFactory> {
  if (window.mountCraftscriptPrivyRuntime) {
    return Promise.resolve(window.mountCraftscriptPrivyRuntime);
  }

  if (runtimeFactoryPromise) {
    return runtimeFactoryPromise;
  }

  runtimeFactoryPromise = new Promise<PrivyRuntimeFactory>(
    (resolve, reject) => {
      const script = document.createElement('script');
      script.src = PRIVY_RUNTIME_SCRIPT_URL;
      script.async = true;
      script.dataset['craftscriptPrivyLoader'] = 'true';
      script.onload = () => {
        if (window.mountCraftscriptPrivyRuntime) {
          resolve(window.mountCraftscriptPrivyRuntime);
          return;
        }
        reject(new Error('Privy runtime did not register its factory'));
      };
      script.onerror = () => reject(new Error('Privy runtime failed to load'));
      document.head.appendChild(script);
    }
  ).catch(error => {
    runtimeFactoryPromise = undefined;
    throw error;
  });

  return runtimeFactoryPromise;
}

async function mountDefaultPrivyRuntime(
  config: PublicAuthConfig,
  onReady: (bridge: CraftscriptPrivyBridge) => void
): Promise<PrivyRuntimeHandle> {
  const runtimeFactory = await loadPrivyRuntimeFactory();
  return runtimeFactory(config, onReady);
}

export const PRIVY_RUNTIME_MOUNTER = new InjectionToken<PrivyRuntimeMounter>(
  'PRIVY_RUNTIME_MOUNTER',
  {
    providedIn: 'root',
    factory: () => mountDefaultPrivyRuntime,
  }
);
