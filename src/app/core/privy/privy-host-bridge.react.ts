import React, { useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import {
  CraftscriptPrivyBridge,
  PrivyBridgeUser,
  PrivyEmbeddedWallet,
} from './privy-bridge.types';

type PrivyHostBridgeOptions = {
  appId: string;
  clientId?: string;
};

type PrivyState = {
  privyReady: boolean;
  walletsReady: boolean;
  authenticated: boolean;
  user: PrivyBridgeUser | null;
  wallets: PrivyEmbeddedWallet[];
};

type EthereumTransaction = {
  from: string;
  to: string;
  value?: string;
  data?: string;
};

const WAIT_TIMEOUT_MS = 30_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toPrivyUser(value: unknown): PrivyBridgeUser | null {
  return isObject(value) ? (value as PrivyBridgeUser) : null;
}

function toWallets(value: unknown[]): PrivyEmbeddedWallet[] {
  return value.filter(isObject).map(wallet => wallet as PrivyEmbeddedWallet);
}

function findEmbeddedWallet(
  wallets: PrivyEmbeddedWallet[]
): PrivyEmbeddedWallet | null {
  return (
    wallets.find(
      wallet =>
        typeof wallet.address === 'string' &&
        (wallet.walletClientType === 'privy' ||
          wallet.walletClientType === 'embedded')
    ) ??
    wallets.find(wallet => typeof wallet.address === 'string') ??
    null
  );
}

function waitFor(
  stateRef: React.MutableRefObject<PrivyState>,
  listenersRef: React.MutableRefObject<Set<() => void>>,
  predicate: (state: PrivyState) => boolean
): Promise<PrivyState> {
  if (predicate(stateRef.current)) {
    return Promise.resolve(stateRef.current);
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      listenersRef.current.delete(check);
      reject(new Error('Timed out waiting for Privy state'));
    }, WAIT_TIMEOUT_MS);

    const check = () => {
      const state = stateRef.current;
      if (!predicate(state)) {
        return;
      }
      window.clearTimeout(timeout);
      listenersRef.current.delete(check);
      resolve(state);
    };

    listenersRef.current.add(check);
  });
}

function useCraftscriptPrivyBridge(): CraftscriptPrivyBridge {
  const privy = usePrivy();
  const walletsState = useWallets();
  const stateRef = useRef<PrivyState>({
    privyReady: false,
    walletsReady: false,
    authenticated: false,
    user: null,
    wallets: [],
  });
  const listenersRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    stateRef.current = {
      privyReady: privy.ready,
      walletsReady: walletsState.ready,
      authenticated: privy.authenticated,
      user: toPrivyUser(privy.user),
      wallets: toWallets(walletsState.wallets),
    };
    listenersRef.current.forEach(listener => listener());
  }, [
    privy.ready,
    privy.authenticated,
    privy.user,
    walletsState.ready,
    walletsState.wallets,
  ]);

  return useMemo(() => {
    const getEmbeddedWallet = async () => {
      const state = await waitFor(
        stateRef,
        listenersRef,
        next => next.authenticated && next.walletsReady
      );
      return findEmbeddedWallet(state.wallets);
    };

    return {
      async login() {
        await waitFor(stateRef, listenersRef, state => state.privyReady);

        if (!stateRef.current.authenticated) {
          await privy.login();
        }

        const state = await waitFor(
          stateRef,
          listenersRef,
          next => next.authenticated && next.walletsReady
        );
        const wallet = findEmbeddedWallet(state.wallets);
        if (!wallet) {
          throw new Error(
            'Privy did not create an embedded wallet for this user.'
          );
        }
        return state.user ?? undefined;
      },
      async getAccessToken() {
        await waitFor(stateRef, listenersRef, state => state.privyReady);
        return privy.getAccessToken();
      },
      async getUser() {
        await waitFor(stateRef, listenersRef, state => state.privyReady);
        return stateRef.current.user;
      },
      getEmbeddedWallet,
      async signMessage({ message, address }) {
        const wallet = await getEmbeddedWallet();
        if (!wallet?.getEthereumProvider) {
          throw new Error('Privy embedded wallet provider is unavailable.');
        }
        const provider = await wallet.getEthereumProvider();
        const account = address ?? wallet.address;
        const signature = await provider.request({
          method: 'personal_sign',
          params: [message, account],
        });
        if (typeof signature !== 'string') {
          throw new Error('Privy did not return a message signature.');
        }
        return { signature };
      },
      async sendTransaction(input: EthereumTransaction) {
        const wallet = await getEmbeddedWallet();
        if (!wallet?.getEthereumProvider) {
          throw new Error('Privy embedded wallet provider is unavailable.');
        }
        const provider = await wallet.getEthereumProvider();
        const hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [input],
        });
        if (typeof hash !== 'string') {
          throw new Error('Privy did not return a transaction hash.');
        }
        return { hash };
      },
    };
  }, [privy]);
}

function PrivyBridgeRegistrar(): null {
  const bridge = useCraftscriptPrivyBridge();

  useEffect(() => {
    window.craftscriptPrivy = bridge;
    return () => {
      if (window.craftscriptPrivy === bridge) {
        delete window.craftscriptPrivy;
      }
    };
  }, [bridge]);

  return null;
}

function PrivyBridgeRoot({ appId, clientId }: PrivyHostBridgeOptions) {
  return React.createElement(
    PrivyProvider,
    {
      appId,
      clientId,
      config: {
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        loginMethods: ['email', 'google', 'passkey'],
      },
    },
    React.createElement(PrivyBridgeRegistrar)
  );
}

export function mountPrivyHostBridge(
  element: HTMLElement,
  options: PrivyHostBridgeOptions
): Root {
  const root = createRoot(element);
  root.render(React.createElement(PrivyBridgeRoot, options));
  return root;
}
