import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActiveWalletFacade } from '@domains/wallet/application/active-wallet.facade';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  type Observable,
} from 'rxjs';
import { ClientRpcPreferencesService } from './client-rpc-preferences.service';
import { ClientRpcProbeService } from './client-rpc-probe.service';
import type {
  RpcEndpointChoice,
  RpcHealthLevel,
  RpcNetworkId,
  RpcProbeResult,
  RpcResolvedEndpoint,
} from './client-rpc.models';
import {
  CLIENT_RPC_NETWORKS,
  findRpcNetwork,
  resolveRpcNetworkId,
} from './client-rpc.presets';

export type RpcStatusSummary = {
  readonly networkId: RpcNetworkId;
  readonly networkLabel: string;
  readonly endpoint: RpcResolvedEndpoint;
  readonly probe: RpcProbeResult | null;
  readonly level: RpcHealthLevel;
  readonly latencyMs: number | null;
};

@Injectable({ providedIn: 'root' })
export class ClientRpcFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly preferences = inject(ClientRpcPreferencesService);
  private readonly probeService = inject(ClientRpcProbeService);
  private readonly activeWallet = inject(ActiveWalletFacade);

  private readonly settingsOpenSubject = new BehaviorSubject(false);
  /** Network shown in the settings drawer (may differ from the active wallet). */
  private readonly selectedNetworkSubject = new BehaviorSubject<RpcNetworkId>(
    'eip155:1'
  );
  /** Network that drives the menu status dot and background health polling. */
  private readonly activeNetworkSubject = new BehaviorSubject<RpcNetworkId>(
    'eip155:1'
  );
  private readonly probesSubject = new BehaviorSubject<
    Partial<Record<RpcNetworkId, RpcProbeResult>>
  >({});
  private readonly fallbackSubject = new BehaviorSubject<
    Partial<Record<RpcNetworkId, boolean>>
  >({});
  private readonly testingSubject = new BehaviorSubject(false);
  private readonly testMessageSubject = new BehaviorSubject<string>('');

  private probeTimer: ReturnType<typeof setInterval> | null = null;
  private probing = false;
  private pendingRefresh: RpcNetworkId | null = null;

  public readonly settingsOpen$ = this.settingsOpenSubject.asObservable();
  public readonly selectedNetwork$ = this.selectedNetworkSubject.asObservable();
  public readonly testing$ = this.testingSubject.asObservable();
  public readonly testMessage$ = this.testMessageSubject.asObservable();
  public readonly networks = CLIENT_RPC_NETWORKS;

  public readonly status$: Observable<RpcStatusSummary> = combineLatest([
    this.activeNetworkSubject,
    this.preferences.preferences$,
    this.probesSubject,
    this.fallbackSubject,
  ]).pipe(
    map(([networkId]) => this.buildStatus(networkId)),
    distinctUntilChanged(
      (left, right) =>
        left.networkId === right.networkId &&
        left.level === right.level &&
        left.latencyMs === right.latencyMs &&
        left.endpoint.url === right.endpoint.url &&
        left.endpoint.usingFallback === right.endpoint.usingFallback
    )
  );

  constructor() {
    this.activeWallet.state$
      .pipe(
        map(state => resolveRpcNetworkId(state.network)),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(networkId => {
        this.activeNetworkSubject.next(networkId);
        // Do not clobber an in-progress settings browse of another network.
        if (!this.settingsOpenSubject.value) {
          this.selectedNetworkSubject.next(networkId);
        }
        void this.refreshNetwork(networkId);
      });

    this.startPolling();
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  public openSettings(networkId?: RpcNetworkId): void {
    if (networkId) {
      this.selectedNetworkSubject.next(networkId);
    } else {
      this.selectedNetworkSubject.next(this.activeNetworkSubject.value);
    }
    this.testMessageSubject.next('');
    this.settingsOpenSubject.next(true);
    void this.refreshNetwork(this.selectedNetworkSubject.value);
  }

  public closeSettings(): void {
    this.settingsOpenSubject.next(false);
    this.testMessageSubject.next('');
    // Restore selection + refresh so the menu dot keeps the active wallet current.
    this.selectedNetworkSubject.next(this.activeNetworkSubject.value);
    void this.refreshNetwork(this.activeNetworkSubject.value);
  }

  public selectNetwork(networkId: RpcNetworkId): void {
    this.selectedNetworkSubject.next(networkId);
    this.testMessageSubject.next('');
    void this.refreshNetwork(networkId);
  }

  public endpointFor(networkId: RpcNetworkId): RpcResolvedEndpoint {
    const preferred = this.preferences.resolvePreferredUrl(networkId);
    const usingFallback = this.fallbackSubject.value[networkId] === true;
    const network = findRpcNetwork(networkId);
    if (usingFallback && network) {
      return {
        networkId,
        url: network.defaultUrl,
        label: 'Default (fallback)',
        source: 'default',
        usingFallback: true,
        savedCustomUrl: preferred.savedCustomUrl ?? preferred.url,
      };
    }
    return {
      networkId,
      url: preferred.url,
      label: preferred.label,
      source: preferred.source,
      usingFallback: false,
      savedCustomUrl: preferred.savedCustomUrl,
    };
  }

  public statusSnapshot(): RpcStatusSummary {
    return this.buildStatus(this.activeNetworkSubject.value);
  }

  public async useDefault(networkId: RpcNetworkId): Promise<void> {
    this.preferences.reset(networkId);
    this.patchFallback(networkId, false);
    this.testMessageSubject.next('Reset to the default RPC.');
    await this.refreshNetwork(networkId);
  }

  public async usePreset(
    networkId: RpcNetworkId,
    presetId: string
  ): Promise<void> {
    this.preferences.setChoice(networkId, { mode: 'preset', presetId });
    this.patchFallback(networkId, false);
    this.testMessageSubject.next('');
    await this.refreshNetwork(networkId);
  }

  public async useCustom(
    networkId: RpcNetworkId,
    customUrl: string
  ): Promise<void> {
    const trimmed = customUrl.trim();
    if (!this.isValidRpcUrl(trimmed)) {
      this.testMessageSubject.next('Enter a valid http(s) RPC URL.');
      return;
    }
    this.preferences.setChoice(networkId, {
      mode: 'custom',
      customUrl: trimmed,
    });
    this.patchFallback(networkId, false);
    this.testMessageSubject.next('');
    await this.refreshNetwork(networkId);
  }

  public async testSelected(): Promise<void> {
    const networkId = this.selectedNetworkSubject.value;
    const preferred = this.preferences.resolvePreferredUrl(networkId);
    this.testingSubject.next(true);
    this.testMessageSubject.next('Testing RPC…');
    try {
      const result = await this.probeService.probe(networkId, preferred.url);
      this.patchProbe(result);
      if (result.ok && result.level !== 'failing') {
        this.patchFallback(networkId, false);
        this.testMessageSubject.next(
          `OK — ${result.latencyMs ?? '—'} ms via ${preferred.label}.`
        );
      } else {
        this.patchFallback(networkId, preferred.source !== 'default');
        this.testMessageSubject.next(
          preferred.source === 'default'
            ? `Default RPC failed${result.error ? `: ${result.error}` : '.'}`
            : `Custom/preset failed — falling back to default. ${
                result.error ?? ''
              }`.trim()
        );
        if (preferred.source !== 'default') {
          const network = findRpcNetwork(networkId);
          if (network) {
            const fallback = await this.probeService.probe(
              networkId,
              network.defaultUrl
            );
            this.patchProbe({
              ...fallback,
              // Keep failing level when preferred endpoint is down.
              level: 'failing',
            });
          }
        }
      }
    } finally {
      this.testingSubject.next(false);
    }
  }

  public saveCustomDraft(networkId: RpcNetworkId, customUrl: string): void {
    const current = this.preferences.choiceFor(networkId);
    this.preferences.setChoice(networkId, {
      ...current,
      customUrl: customUrl.trim(),
    });
  }

  public choiceFor(networkId: RpcNetworkId): RpcEndpointChoice {
    return this.preferences.choiceFor(networkId);
  }

  /** Effective URL for any client-side RPC work on this network. */
  public effectiveUrl(networkId: RpcNetworkId): string {
    return this.endpointFor(networkId).url;
  }

  private buildStatus(networkId: RpcNetworkId): RpcStatusSummary {
    const network = findRpcNetwork(networkId);
    const endpoint = this.endpointFor(networkId);
    const probe = this.probesSubject.value[networkId] ?? null;
    const level: RpcHealthLevel =
      endpoint.usingFallback || !probe
        ? endpoint.usingFallback
          ? 'failing'
          : (probe?.level ?? 'slow')
        : probe.level;
    return {
      networkId,
      networkLabel: network?.label ?? networkId,
      endpoint,
      probe,
      level: probe ? level : endpoint.usingFallback ? 'failing' : 'slow',
      latencyMs: probe?.latencyMs ?? null,
    };
  }

  private startPolling(): void {
    void this.refreshNetwork(this.activeNetworkSubject.value);
    this.probeTimer = setInterval(() => {
      void this.refreshNetwork(this.activeNetworkSubject.value);
    }, 30_000);
  }

  private stopPolling(): void {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
  }

  private async refreshNetwork(networkId: RpcNetworkId): Promise<void> {
    if (this.probing) {
      this.pendingRefresh = networkId;
      return;
    }
    this.probing = true;
    try {
      const preferred = this.preferences.resolvePreferredUrl(networkId);
      const preferredProbe = await this.probeService.probe(
        networkId,
        preferred.url
      );
      if (preferredProbe.ok && preferredProbe.level !== 'failing') {
        this.patchFallback(networkId, false);
        this.patchProbe(preferredProbe);
        return;
      }

      if (preferred.source !== 'default') {
        const network = findRpcNetwork(networkId);
        if (network) {
          const fallbackProbe = await this.probeService.probe(
            networkId,
            network.defaultUrl
          );
          this.patchFallback(networkId, true);
          this.patchProbe({
            ...fallbackProbe,
            level: 'failing',
            error:
              preferredProbe.error ||
              'Preferred RPC failed; using default fallback.',
          });
          return;
        }
      }

      this.patchFallback(networkId, false);
      this.patchProbe(preferredProbe);
    } finally {
      this.probing = false;
      const pending = this.pendingRefresh;
      this.pendingRefresh = null;
      if (pending) {
        void this.refreshNetwork(pending);
      }
    }
  }

  private patchProbe(result: RpcProbeResult): void {
    this.probesSubject.next({
      ...this.probesSubject.value,
      [result.networkId]: result,
    });
  }

  private patchFallback(networkId: RpcNetworkId, usingFallback: boolean): void {
    this.fallbackSubject.next({
      ...this.fallbackSubject.value,
      [networkId]: usingFallback,
    });
  }

  private isValidRpcUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }
}
