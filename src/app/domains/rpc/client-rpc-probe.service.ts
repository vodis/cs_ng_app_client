import { Injectable } from '@angular/core';
import {
  classifyRpcLatency,
  RPC_PROBE_TIMEOUT_MS,
  type RpcHealthLevel,
  type RpcNetworkFamily,
  type RpcNetworkId,
  type RpcProbeResult,
} from './client-rpc.models';
import { findRpcNetwork } from './client-rpc.presets';

@Injectable({ providedIn: 'root' })
export class ClientRpcProbeService {
  public async probe(
    networkId: RpcNetworkId,
    url: string
  ): Promise<RpcProbeResult> {
    const network = findRpcNetwork(networkId);
    const family = network?.family ?? 'evm';
    const started = performance.now();
    try {
      await this.request(family, networkId, url);
      const latencyMs = Math.round(performance.now() - started);
      const level = classifyRpcLatency(latencyMs, true);
      return {
        networkId,
        url,
        ok: level !== 'failing',
        latencyMs,
        level,
        checkedAt: Date.now(),
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - started);
      return {
        networkId,
        url,
        ok: false,
        latencyMs,
        level: 'failing',
        checkedAt: Date.now(),
        error: error instanceof Error ? error.message : 'RPC probe failed',
      };
    }
  }

  private async request(
    family: RpcNetworkFamily,
    networkId: RpcNetworkId,
    url: string
  ): Promise<void> {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => controller.abort(),
      RPC_PROBE_TIMEOUT_MS
    );
    try {
      if (family === 'ton') {
        await this.tonProbe(url, controller.signal);
        return;
      }
      if (family === 'solana') {
        await this.jsonRpc(url, 'getHealth', [], controller.signal);
        return;
      }
      if (family === 'near') {
        await this.jsonRpc(url, 'status', [], controller.signal);
        return;
      }
      await this.evmProbe(networkId, url, controller.signal);
    } finally {
      window.clearTimeout(timer);
    }
  }

  private async evmProbe(
    networkId: RpcNetworkId,
    url: string,
    signal: AbortSignal
  ): Promise<void> {
    const expected = expectedEvmChainId(networkId);
    if (expected === null) {
      throw new Error(`Unsupported EVM network ${networkId}`);
    }

    const chainIdResult = await this.jsonRpc(url, 'eth_chainId', [], signal);
    const actual = parseHexChainId(chainIdResult);
    if (actual !== expected) {
      throw new Error(
        `RPC chain mismatch: expected ${expected}, got ${actual}`
      );
    }

    await this.jsonRpc(url, 'eth_blockNumber', [], signal);
  }

  private async jsonRpc(
    url: string,
    method: string,
    params: unknown[],
    signal: AbortSignal
  ): Promise<unknown> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      error?: { message?: string };
      result?: unknown;
    };
    if (payload.error) {
      throw new Error(payload.error.message || 'RPC error');
    }
    if (payload.result === undefined) {
      throw new Error('Empty RPC result');
    }
    return payload.result;
  }

  private async tonProbe(url: string, signal: AbortSignal): Promise<void> {
    // Toncenter JSON-RPC and some gateways accept method getMasterchainInfo.
    try {
      await this.jsonRpc(url, 'getMasterchainInfo', [], signal);
      return;
    } catch {
      // Fallback: HTTP GET style used by some public TON endpoints.
      const trimmed = url.replace(/\/jsonRPC\/?$/i, '');
      const response = await fetch(`${trimmed}/getMasterchainInfo`, {
        method: 'GET',
        signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { ok?: boolean };
      if (payload.ok === false) {
        throw new Error('TON RPC rejected request');
      }
    }
  }
}

export function expectedEvmChainId(networkId: RpcNetworkId): number | null {
  const match = /^eip155:(\d+)$/.exec(networkId);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

export function parseHexChainId(result: unknown): number {
  if (typeof result === 'number' && Number.isFinite(result)) {
    return result;
  }
  if (typeof result === 'string' && result.trim()) {
    const parsed = Number.parseInt(result, 16);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid eth_chainId result: ${result}`);
    }
    return parsed;
  }
  throw new Error('Invalid eth_chainId result');
}

export function rpcHealthLabel(level: RpcHealthLevel): string {
  switch (level) {
    case 'healthy':
      return 'Healthy';
    case 'slow':
      return 'Slow';
    default:
      return 'Failing';
  }
}
