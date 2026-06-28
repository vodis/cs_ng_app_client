import { Inject, Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, timeout } from 'rxjs';
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
import {
  AuthProviderGateway,
  type AuthProviderState,
  type AuthProviderUser,
  type AuthProviderWallet,
} from '@core/auth/auth-provider.gateway';
import type { LoginMethod } from '@core/auth/auth-session.types';
import { AppLoggerService } from '@core/logging/app-logger.service';
import './privy-bridge.types';

@Injectable({ providedIn: 'root' })
export class PrivyBridgeService
  extends AuthProviderGateway
  implements OnDestroy
{
  private readonly stateSubject = new BehaviorSubject<AuthProviderState>({
    status: 'loading',
    loginMethods: ['email'],
  });
  private activeBridge: CraftscriptPrivyBridge | undefined;
  private assignedBridge: CraftscriptPrivyBridge | undefined;
  private listeningForSource = false;
  private runtimeBridge: CraftscriptPrivyBridge | undefined;
  private runtimeHandle: PrivyRuntimeHandle | undefined;
  private runtimeStartupTimeout: number | undefined;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly ngZone: NgZone,
    @Inject(PRIVY_RUNTIME_MOUNTER)
    private readonly mountRuntime: PrivyRuntimeMounter,
    private readonly logger: AppLoggerService
  ) {
    super();
  }

  readonly state$ = this.stateSubject.asObservable();

  get state(): AuthProviderState {
    return this.stateSubject.value;
  }

  async initialize(): Promise<void> {
    this.listenForSource();
    this.mountBridge();

    let config: PublicAuthConfig;
    try {
      config = await this.fetchPublicAuthConfig();
    } catch (error) {
      if (!this.activeBridge) {
        this.setFailedState('Account login configuration is unavailable.');
      }
      this.logProviderError('auth_provider.config_failed', error);
      return;
    }

    if (this.isPrivyEnabled(config)) {
      this.updateState({ loginMethods: [...config.loginMethods] });
      if (!this.mountBridge()) {
        await this.initializeRuntime(config);
      }
      return;
    }

    if (!this.activeBridge) {
      this.stateSubject.next({ status: 'disabled', loginMethods: [] });
    }
  }

  async login(method: LoginMethod): Promise<AuthProviderUser | void> {
    return this.requireBridge().login(method);
  }

  async getAccessToken(): Promise<string | null> {
    return this.activeBridge?.getAccessToken() ?? null;
  }

  async getUser(): Promise<AuthProviderUser | null> {
    return this.activeBridge?.getUser() ?? null;
  }

  async getEmbeddedWallet(): Promise<AuthProviderWallet | null> {
    return this.activeBridge?.getEmbeddedWallet() ?? null;
  }

  private fetchPublicAuthConfig(): Promise<PublicAuthConfig> {
    return firstValueFrom(
      this.httpClient
        .get<PublicAuthConfig>(
          `${environment.apiUrl}/api/v1/public/auth-config`
        )
        .pipe(timeout(3000))
    );
  }

  private isPrivyEnabled(config: PublicAuthConfig): config is PublicAuthConfig {
    return config.enabled !== false && Boolean(config.privyAppId?.trim());
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
    if (!bridge) {
      return false;
    }

    this.activeBridge = bridge;
    if (window.craftscriptPrivy !== bridge) {
      window.craftscriptPrivy = bridge;
      this.assignedBridge = bridge;
    }
    this.clearRuntimeStartupTimeout();
    this.updateState({ status: 'ready', error: undefined });
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
    } catch (error) {
      this.handleRuntimeError();
      this.logProviderError('auth_provider.runtime_failed', error);
    }
  }

  private handleRuntimeReady(bridge: CraftscriptPrivyBridge): void {
    this.ngZone.run(() => {
      this.clearRuntimeStartupTimeout();
      this.runtimeBridge = bridge;
      window.craftscriptPrivySource = bridge;
      this.mountBridge();
      window.dispatchEvent(new Event(PRIVY_SOURCE_READY_EVENT));
    });
  }

  private handleRuntimeError(): void {
    this.ngZone.run(() => {
      this.clearRuntimeStartupTimeout();
      if (this.activeBridge) {
        return;
      }
      this.setFailedState('Account provider failed to start.');
    });
  }

  private clearRuntimeStartupTimeout(): void {
    if (this.runtimeStartupTimeout !== undefined) {
      window.clearTimeout(this.runtimeStartupTimeout);
      this.runtimeStartupTimeout = undefined;
    }
  }

  private requireBridge(): CraftscriptPrivyBridge {
    if (!this.activeBridge) {
      throw new Error('Account provider is not available');
    }
    return this.activeBridge;
  }

  private updateState(update: Partial<AuthProviderState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...update });
  }

  private setFailedState(error: string): void {
    this.updateState({ status: 'failed', error });
  }

  private logProviderError(event: string, error: unknown): void {
    this.logger.log('error', event, {
      provider: 'privy',
      errorCode: error instanceof Error ? error.name : 'unknown',
    });
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
    this.activeBridge = undefined;

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
    this.stateSubject.complete();
  }
}
