import type { CraftscriptPrivyBridge } from './privy-bridge.types';

export const PRIVY_SOURCE_READY_EVENT = 'craftscript:privy-source-ready';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isCraftscriptPrivyBridge(
  value: unknown
): value is CraftscriptPrivyBridge {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value['login'] === 'function' &&
    typeof value['getAccessToken'] === 'function' &&
    typeof value['getUser'] === 'function' &&
    typeof value['getEmbeddedWallet'] === 'function' &&
    typeof value['signMessage'] === 'function' &&
    typeof value['sendTransaction'] === 'function'
  );
}

export function resolvePrivyHostBridge(): CraftscriptPrivyBridge | undefined {
  if (isCraftscriptPrivyBridge(window.craftscriptPrivy)) {
    return window.craftscriptPrivy;
  }

  if (isCraftscriptPrivyBridge(window.craftscriptPrivySource)) {
    return window.craftscriptPrivySource;
  }

  return undefined;
}
