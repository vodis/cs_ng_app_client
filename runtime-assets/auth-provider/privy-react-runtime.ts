// This adapter is compiled as an isolated browser asset, not as Angular source.
import {
  createElement,
  useEffect,
  useRef,
  type FunctionComponent,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  PrivyProvider,
  useLogin,
  usePrivy,
  useSendTransaction,
  useSignMessage,
  useWallets,
  type ConnectedWallet,
  type PrivyClientConfig,
  type User,
} from '@privy-io/react-auth';
import type {
  CraftscriptPrivyBridge,
  PrivyBridgeUser,
  PrivyEmbeddedWallet,
  PublicAuthConfig,
  PublicAuthLoginMethod,
  PrivyRuntimeHandle,
} from '../../src/app/core/privy/privy-bridge.types';

type PendingLogin = {
  resolve: (user: PrivyBridgeUser | void) => void;
  reject: (error: Error) => void;
};

type BridgeAdapterProps = {
  onReady: (bridge: CraftscriptPrivyBridge) => void;
};

function toBridgeUser(user: User | null): PrivyBridgeUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ? { address: user.email.address } : undefined,
    wallet: user.wallet
      ? {
          address: user.wallet.address,
          walletClientType: user.wallet.walletClientType,
          chainType: user.wallet.chainType,
        }
      : undefined,
  };
}

function isEmbeddedWallet(wallet: ConnectedWallet): boolean {
  return (
    wallet.walletClientType === 'privy' ||
    wallet.walletClientType === 'privy-v2'
  );
}

function toEmbeddedWallet(
  wallet: ConnectedWallet | undefined
): PrivyEmbeddedWallet | null {
  if (!wallet) {
    return null;
  }

  return {
    address: wallet.address,
    walletClientType: wallet.walletClientType,
    chainType: wallet.type,
  };
}

export function buildPrivyClientConfig(
  config: PublicAuthConfig
): PrivyClientConfig {
  return {
    loginMethods: [...config.loginMethods],
    appearance: {
      theme: 'dark',
    },
    embeddedWallets: {
      ethereum: {
        createOnLogin: config.walletOnboarding.embeddedWallet
          ? 'users-without-wallets'
          : 'off',
      },
    },
  };
}

const PrivyBridgeAdapter: FunctionComponent<BridgeAdapterProps> = ({
  onReady,
}) => {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const { sendTransaction } = useSendTransaction();
  const pendingLogin = useRef<PendingLogin | null>(null);
  const currentUser = useRef<User | null>(user);
  const currentWallets = useRef<ConnectedWallet[]>(wallets);

  currentUser.current = user;
  currentWallets.current = wallets;

  const { login } = useLogin({
    onComplete: ({ user: loggedInUser }) => {
      pendingLogin.current?.resolve(toBridgeUser(loggedInUser) ?? undefined);
      pendingLogin.current = null;
    },
    onError: loginError => {
      const message = loginError || 'Privy login failed';
      pendingLogin.current?.reject(new Error(message));
      pendingLogin.current = null;
    },
  });

  useEffect(() => {
    if (!ready) {
      return;
    }

    const bridge: CraftscriptPrivyBridge = {
      login: async (method?: PublicAuthLoginMethod) => {
        if (authenticated && currentUser.current) {
          return toBridgeUser(currentUser.current) ?? undefined;
        }

        if (pendingLogin.current) {
          throw new Error('Privy login is already in progress');
        }

        return new Promise<PrivyBridgeUser | void>((resolve, reject) => {
          pendingLogin.current = { resolve, reject };
          login(method ? { loginMethods: [method] } : undefined);
        });
      },
      getAccessToken,
      getUser: async () => toBridgeUser(currentUser.current),
      getEmbeddedWallet: async () =>
        toEmbeddedWallet(currentWallets.current.find(isEmbeddedWallet)),
      signMessage: async input =>
        signMessage(
          { message: input.message },
          input.address ? { address: input.address } : undefined
        ),
      sendTransaction: async input =>
        sendTransaction(input, { address: input.from }),
    };

    onReady(bridge);
  }, [
    authenticated,
    getAccessToken,
    login,
    onReady,
    ready,
    sendTransaction,
    signMessage,
  ]);

  return null;
};

export function mountPrivyReactRuntime(
  config: PublicAuthConfig,
  onReady: (bridge: CraftscriptPrivyBridge) => void
): PrivyRuntimeHandle {
  const appId = config.privyAppId?.trim();
  if (!appId) {
    throw new Error('Privy app ID is required');
  }

  const container = document.createElement('div');
  container.dataset['craftscriptPrivyRuntime'] = 'true';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    createElement(PrivyProvider, {
      appId,
      config: buildPrivyClientConfig(config),
      children: createElement(PrivyBridgeAdapter, { onReady }),
    })
  );

  return {
    destroy: () => {
      root.unmount();
      container.remove();
    },
  };
}

window.mountCraftscriptPrivyRuntime = mountPrivyReactRuntime;
