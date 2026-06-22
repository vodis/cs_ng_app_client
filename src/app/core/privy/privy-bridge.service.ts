import { Injectable, OnDestroy } from '@angular/core';
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
import './privy-bridge.types';

@Injectable({ providedIn: 'root' })
export class PrivyBridgeService implements OnDestroy {
  private assignedBridge: CraftscriptPrivyBridge | undefined;
  private assignedConfig = false;
  private listeningForSource = false;

  constructor(private readonly httpClient: HttpClient) {}

  async initialize(): Promise<void> {
    this.listenForSource();
    this.mountBridge();

    const config = await this.fetchPublicAuthConfig();
    if (this.isPrivyEnabled(config)) {
      window.craftscriptPrivyConfig = config;
      this.assignedConfig = true;
      this.mountBridge();
    }
  }

  private async fetchPublicAuthConfig(): Promise<PublicAuthConfig | null> {
    try {
      return await firstValueFrom(
        this.httpClient.get<PublicAuthConfig>(
          `${environment.apiUrl}/api/v1/public/auth-config`
        ).pipe(timeout(3000))
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

  private mountBridge(): void {
    const bridge = resolvePrivyHostBridge();
    if (!bridge || window.craftscriptPrivy === bridge) {
      return;
    }

    window.craftscriptPrivy = bridge;
    this.assignedBridge = bridge;
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

    if (this.assignedConfig) {
      delete window.craftscriptPrivyConfig;
      this.assignedConfig = false;
    }
  }
}
