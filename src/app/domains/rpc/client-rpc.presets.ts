import type { RpcNetworkDefinition, RpcNetworkId } from './client-rpc.models';

/**
 * Host-owned public defaults for client-side probes and overrides.
 * These are browser-callable endpoints; BFF private RPCs stay server-side.
 */
export const CLIENT_RPC_NETWORKS: readonly RpcNetworkDefinition[] = [
  {
    id: 'eip155:1',
    label: 'Ethereum',
    family: 'evm',
    defaultUrl: 'https://ethereum.publicnode.com',
    presets: [
      {
        id: 'eth-publicnode',
        label: 'PublicNode',
        url: 'https://ethereum.publicnode.com',
      },
      {
        id: 'eth-cloudflare',
        label: 'Cloudflare',
        url: 'https://cloudflare-eth.com',
      },
    ],
  },
  {
    id: 'eip155:8453',
    label: 'Base',
    family: 'evm',
    defaultUrl: 'https://mainnet.base.org',
    presets: [
      {
        id: 'base-official',
        label: 'Base official',
        url: 'https://mainnet.base.org',
      },
      {
        id: 'base-publicnode',
        label: 'PublicNode',
        url: 'https://base.publicnode.com',
      },
    ],
  },
  {
    id: 'eip155:42161',
    label: 'Arbitrum',
    family: 'evm',
    defaultUrl: 'https://arb1.arbitrum.io/rpc',
    presets: [
      {
        id: 'arb-official',
        label: 'Arbitrum official',
        url: 'https://arb1.arbitrum.io/rpc',
      },
      {
        id: 'arb-publicnode',
        label: 'PublicNode',
        url: 'https://arbitrum-one.publicnode.com',
      },
    ],
  },
  {
    id: 'eip155:10',
    label: 'Optimism',
    family: 'evm',
    defaultUrl: 'https://mainnet.optimism.io',
    presets: [
      {
        id: 'op-official',
        label: 'Optimism official',
        url: 'https://mainnet.optimism.io',
      },
      {
        id: 'op-publicnode',
        label: 'PublicNode',
        url: 'https://optimism.publicnode.com',
      },
    ],
  },
  {
    id: 'eip155:137',
    label: 'Polygon',
    family: 'evm',
    defaultUrl: 'https://polygon-rpc.com',
    presets: [
      {
        id: 'pol-polygon-rpc',
        label: 'polygon-rpc.com',
        url: 'https://polygon-rpc.com',
      },
      {
        id: 'pol-publicnode',
        label: 'PublicNode',
        url: 'https://polygon-bor.publicnode.com',
      },
    ],
  },
  {
    id: 'near:mainnet',
    label: 'NEAR',
    family: 'near',
    defaultUrl: 'https://rpc.mainnet.near.org',
    presets: [
      {
        id: 'near-official',
        label: 'NEAR official',
        url: 'https://rpc.mainnet.near.org',
      },
      {
        id: 'near-lava',
        label: 'Lava',
        url: 'https://near.lava.build',
      },
    ],
  },
  {
    id: 'solana:mainnet',
    label: 'Solana',
    family: 'solana',
    defaultUrl: 'https://api.mainnet-beta.solana.com',
    presets: [
      {
        id: 'sol-official',
        label: 'Solana official',
        url: 'https://api.mainnet-beta.solana.com',
      },
      {
        id: 'sol-publicnode',
        label: 'PublicNode',
        url: 'https://solana-rpc.publicnode.com',
      },
    ],
  },
  {
    id: 'ton:mainnet',
    label: 'TON',
    family: 'ton',
    defaultUrl: 'https://toncenter.com/api/v2/jsonRPC',
    presets: [
      {
        id: 'ton-toncenter',
        label: 'Toncenter',
        url: 'https://toncenter.com/api/v2/jsonRPC',
      },
    ],
  },
] as const;

export function findRpcNetwork(
  networkId: string
): RpcNetworkDefinition | undefined {
  return CLIENT_RPC_NETWORKS.find(network => network.id === networkId);
}

export function isRpcNetworkId(value: string): value is RpcNetworkId {
  return CLIENT_RPC_NETWORKS.some(network => network.id === value);
}

/** Map active-wallet CAIP / short ids onto a supported settings network. */
export function resolveRpcNetworkId(network: string | undefined): RpcNetworkId {
  if (!network) {
    return 'eip155:1';
  }
  if (isRpcNetworkId(network)) {
    return network;
  }
  const normalized = network.toLowerCase();
  if (normalized.startsWith('near:')) {
    return 'near:mainnet';
  }
  if (normalized.startsWith('solana:')) {
    return 'solana:mainnet';
  }
  if (normalized.startsWith('ton:')) {
    return 'ton:mainnet';
  }
  if (normalized === 'eth' || normalized === 'ethereum') {
    return 'eip155:1';
  }
  if (normalized === 'base') {
    return 'eip155:8453';
  }
  if (normalized === 'arb' || normalized === 'arbitrum') {
    return 'eip155:42161';
  }
  if (normalized === 'op' || normalized === 'optimism') {
    return 'eip155:10';
  }
  if (normalized === 'pol' || normalized === 'polygon') {
    return 'eip155:137';
  }
  const eipMatch = /^eip155:(\d+)$/.exec(normalized);
  if (eipMatch) {
    const chainId = Number(eipMatch[1]);
    const map: Record<number, RpcNetworkId> = {
      1: 'eip155:1',
      10: 'eip155:10',
      137: 'eip155:137',
      8453: 'eip155:8453',
      42161: 'eip155:42161',
    };
    return map[chainId] ?? 'eip155:1';
  }
  return 'eip155:1';
}
