/** Latency below this is healthy (green). */
export const RPC_LATENCY_HEALTHY_MS = 800;
/** Latency below this (and ≥ healthy) is slow (amber); above is failing. */
export const RPC_LATENCY_SLOW_MS = 2500;
/** Abort probe after this many ms. */
export const RPC_PROBE_TIMEOUT_MS = 5000;

export type RpcHealthLevel = 'healthy' | 'slow' | 'failing';

export type RpcNetworkFamily = 'evm' | 'near' | 'solana' | 'ton';

export type RpcNetworkId =
  | 'eip155:1'
  | 'eip155:8453'
  | 'eip155:42161'
  | 'eip155:10'
  | 'eip155:137'
  | 'near:mainnet'
  | 'solana:mainnet'
  | 'ton:mainnet';

export type RpcPreset = {
  readonly id: string;
  readonly label: string;
  readonly url: string;
};

export type RpcNetworkDefinition = {
  readonly id: RpcNetworkId;
  readonly label: string;
  readonly family: RpcNetworkFamily;
  readonly defaultUrl: string;
  readonly presets: readonly RpcPreset[];
};

export type RpcEndpointMode = 'default' | 'preset' | 'custom';

export type RpcEndpointChoice = {
  readonly mode: RpcEndpointMode;
  readonly presetId?: string;
  readonly customUrl?: string;
};

export type ClientRpcPreferencesV1 = {
  readonly version: 1;
  readonly networks: Readonly<Record<string, RpcEndpointChoice>>;
};

export type RpcResolvedEndpoint = {
  readonly networkId: RpcNetworkId;
  readonly url: string;
  readonly label: string;
  readonly source: 'default' | 'preset' | 'custom';
  /** True when the user preferred custom/preset but we are on default due to failure. */
  readonly usingFallback: boolean;
  readonly savedCustomUrl?: string;
};

export type RpcProbeResult = {
  readonly networkId: RpcNetworkId;
  readonly url: string;
  readonly ok: boolean;
  readonly latencyMs: number | null;
  readonly level: RpcHealthLevel;
  readonly checkedAt: number;
  readonly error?: string;
};

export function classifyRpcLatency(
  latencyMs: number | null,
  ok: boolean
): RpcHealthLevel {
  if (!ok || latencyMs === null) {
    return 'failing';
  }
  if (latencyMs < RPC_LATENCY_HEALTHY_MS) {
    return 'healthy';
  }
  if (latencyMs < RPC_LATENCY_SLOW_MS) {
    return 'slow';
  }
  return 'failing';
}
