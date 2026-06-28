import { Inject, Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import {
  PRIVY_SOURCE_READY_EVENT,
  resolvePrivyHostBridge,
} from './privy-host-bridge';
import type {
  CraftscriptPrivyBridge,
  PublicAuthConfig,
} from './privy-bridge.types';
import { environment } from '../../../environments/environment';
import {
  PRIVY_RUNTIME_MOUNTER,
  type PrivyRuntimeMounter,
} from './privy-runtime';
import type { PrivyRuntimeHandle } from './privy-bridge.types';
import './privy-bridge.types';

@Injectable({ providedIn: 'root' })
export class PrivyBridgeService implements OnDestroy {
  private assignedBridge: CraftscriptPrivyBridge | undefined;
  private assignedConfig = false;
  private listeningForSource = false;
  private runtimeBridge: CraftscriptPrivyBridge | undefined;
  private runtimeHandle: PrivyRuntimeHandle | undefined;
  private runtimeStartupTimeout: number | undefined;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly ngZone: NgZone,
    @Inject(PRIVY_RUNTIME_MOUNTER)
    private readonly mountRuntime: PrivyRuntimeMounter
  ) {}

  async initialize(): Promise<void> {
    this.listenForSource();
    this.mountBridge();

    const config = await this.fetchPublicAuthConfig();
    if (this.isPrivyEnabled(config)) {
      window.craftscriptPrivyConfig = config;
      this.assignedConfig = true;
      if (!this.mountBridge()) {
        await this.initializeRuntime(config);
      }
    }
  }

  private async fetchPublicAuthConfig(): Promise<PublicAuthConfig | null> {
    try {
      return await firstValueFrom(
        this.httpClient
          .get<PublicAuthConfig>(
            `${environment.apiUrl}/api/v1/public/auth-config`
          )
          .pipe(timeout(3000))
      );
    } catch {
      return null;
    }
  }

  private isPrivyEnabled(
    config: PublicAuthConfig | null
  ): config is PublicAuthConfig {
    return Boolean(config?.privyAppId?.trim());
  }

  private listenForSource(): void {
    if (this.listeningForSource) {
      return;
    }

    window.addEventListener(PRIVY_SOURCE_READY_EVENT, this.sourceReadyListener);
    this.listeningForSource = true;
  }

  private readonly sourceReadyListener = () => {
    this.mountBridge();
  };

  private mountBridge(): boolean {
    const bridge = resolvePrivyHostBridge();
    if (!bridge || window.craftscriptPrivy === bridge) {
      return Boolean(bridge);
    }

    window.craftscriptPrivy = bridge;
    this.assignedBridge = bridge;
    return true;
  }

  private async initializeRuntime(config: PublicAuthConfig): Promise<void> {
    try {
      this.runtimeStartupTimeout = window.setTimeout(
        () => this.handleRuntimeError(),
        10_000
      );
      this.runtimeHandle = await this.mountRuntime(config, bridge =>
        this.handleRuntimeReady(bridge)
      );
    } catch {
      this.handleRuntimeError();
    }
  }

  private handleRuntimeReady(bridge: CraftscriptPrivyBridge): void {
    this.ngZone.run(() => {
      this.clearRuntimeStartupTimeout();
      this.runtimeBridge = bridge;
      window.craftscriptPrivySource = bridge;
      delete window.craftscriptPrivyError;
      this.mountBridge();
      window.dispatchEvent(new Event(PRIVY_SOURCE_READY_EVENT));
    });
  }

  private handleRuntimeError(): void {
    this.ngZone.run(() => {
      this.clearRuntimeStartupTimeout();
      window.craftscriptPrivyError = 'Account provider failed to start.';
    });
  }

  private clearRuntimeStartupTimeout(): void {
    if (this.runtimeStartupTimeout !== undefined) {
      window.clearTimeout(this.runtimeStartupTimeout);
      this.runtimeStartupTimeout = undefined;
    }
  }

  ngOnDestroy(): void {
    if (this.listeningForSource) {
      window.removeEventListener(
        PRIVY_SOURCE_READY_EVENT,
        this.sourceReadyListener
      );
      this.listeningForSource = false;
    }

    if (
      this.assignedBridge &&
      window.craftscriptPrivy === this.assignedBridge
    ) {
      delete window.craftscriptPrivy;
    }

    this.assignedBridge = undefined;

    this.runtimeHandle?.destroy();
    this.runtimeHandle = undefined;
    this.clearRuntimeStartupTimeout();

    if (
      this.runtimeBridge &&
      window.craftscriptPrivySource === this.runtimeBridge
    ) {
      delete window.craftscriptPrivySource;
    }
    this.runtimeBridge = undefined;
    delete window.craftscriptPrivyError;

    if (this.assignedConfig) {
      delete window.craftscriptPrivyConfig;
      this.assignedConfig = false;
    }
  }
}
