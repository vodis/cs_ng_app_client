import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';
import { BehaviorSubject, firstValueFrom, timeout } from 'rxjs';
import {
  AUTH_PROVIDER_CONTRACT_VERSION,
  AuthProviderLoginMethod,
  AuthProviderMountApi,
  AuthProviderRemoteModule,
  AuthProviderSnapshot,
  AuthProviderUser,
  PublicAuthConfig,
} from '@mfe-contracts/auth-provider.types';
import { environment } from '../../../environments/environment';
import { AppLoggerService } from '@core/logging/app-logger.service';

const REMOTE_NAME = 'mfe-wallets';
const REMOTE_LOAD_TIMEOUT_MS = 15_000;
const INITIAL_SNAPSHOT: AuthProviderSnapshot = {
  status: 'loading',
  loginMethods: [],
};

export type AuthProviderRemoteLoader = () => Promise<unknown>;

export const AUTH_PROVIDER_REMOTE_LOADER =
  new InjectionToken<AuthProviderRemoteLoader>('AUTH_PROVIDER_REMOTE_LOADER', {
    providedIn: 'root',
    factory: () => () =>
      loadRemoteModule({
        type: 'manifest',
        remoteName: REMOTE_NAME,
        exposedModule: './auth-provider',
      }),
  });

@Injectable({ providedIn: 'root' })
export class AuthProviderService implements OnDestroy {
  private readonly snapshotSubject = new BehaviorSubject<AuthProviderSnapshot>(
    INITIAL_SNAPSHOT
  );
  private initialization: Promise<AuthProviderSnapshot> | undefined;
  private mountApi: AuthProviderMountApi | undefined;
  private unsubscribe: (() => void) | undefined;
  private container: HTMLElement | undefined;
  private publicConfig: PublicAuthConfig | undefined;

  readonly snapshot$ = this.snapshotSubject.asObservable();

  constructor(
    private readonly httpClient: HttpClient,
    @Inject(AUTH_PROVIDER_REMOTE_LOADER)
    private readonly loadRemote: AuthProviderRemoteLoader,
    private readonly logger: AppLoggerService
  ) {}

  get snapshot(): AuthProviderSnapshot {
    return this.snapshotSubject.value;
  }

  get config(): PublicAuthConfig | undefined {
    return this.publicConfig;
  }

  initialize(): Promise<AuthProviderSnapshot> {
    this.initialization ??= this.start();
    return this.initialization;
  }

  whenSettled(): Promise<AuthProviderSnapshot> {
    return this.initialize();
  }

  login(method: AuthProviderLoginMethod): Promise<AuthProviderUser | void> {
    return this.requireReadyProvider().login(method);
  }

  getAccessToken(): Promise<string | null> {
    return this.mountApi?.getAccessToken() ?? Promise.resolve(null);
  }

  getUser(): Promise<AuthProviderUser | null> {
    return this.mountApi?.getUser() ?? Promise.resolve(null);
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    this.mountApi?.unmount();
    this.container?.remove();
    this.unsubscribe = undefined;
    this.mountApi = undefined;
    this.container = undefined;
  }

  private async start(): Promise<AuthProviderSnapshot> {
    try {
      const config = await this.fetchPublicAuthConfig();
      this.publicConfig = config;
      if (!this.isEnabled(config)) {
        return this.publish({
          status: 'disabled',
          loginMethods: config.loginMethods,
        });
      }

      const loadedModule = await this.withTimeout(
        this.loadRemote(),
        REMOTE_LOAD_TIMEOUT_MS,
        'Account provider remote failed to load.'
      );
      if (!this.isRemoteModule(loadedModule)) {
        throw new Error('Account provider remote contract is invalid.');
      }

      this.container = document.createElement('div');
      this.container.setAttribute('data-auth-provider-root', '');
      document.body.appendChild(this.container);

      const api = loadedModule.mountAuthProvider(this.container, { config });
      if (!this.isMountApi(api)) {
        throw new Error(
          'Account provider contract version or shape is unsupported.'
        );
      }
      this.mountApi = api;
      this.publish(this.normalizeSnapshot(api.getSnapshot()));

      return await new Promise<AuthProviderSnapshot>(resolve => {
        this.unsubscribe = api.subscribe(snapshot => {
          const normalizedSnapshot = this.normalizeSnapshot(snapshot);
          this.publish(normalizedSnapshot);
          if (normalizedSnapshot.status !== 'loading') {
            resolve(normalizedSnapshot);
          }
        });
      });
    } catch (error) {
      this.unsubscribe?.();
      this.mountApi?.unmount();
      this.container?.remove();
      this.unsubscribe = undefined;
      this.mountApi = undefined;
      this.container = undefined;
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Account provider failed to start.';
      this.logger.log('error', 'Account provider startup failed', {
        component: 'AuthProviderService',
        action: 'initialize',
        errorMessage,
      });
      return this.publish({
        status: 'failed',
        loginMethods: this.publicConfig?.loginMethods ?? [],
        error: errorMessage,
      });
    }
  }

  private async fetchPublicAuthConfig(): Promise<PublicAuthConfig> {
    const config = await firstValueFrom(
      this.httpClient
        .get<unknown>(`${environment.apiUrl}/api/v1/public/auth-config`)
        .pipe(timeout(3000))
    );
    if (!this.isPublicAuthConfig(config)) {
      throw new Error('Public auth configuration is invalid.');
    }
    return config;
  }

  private isEnabled(config: PublicAuthConfig): boolean {
    return Boolean(config.enabled !== false && config.privyAppId?.trim());
  }

  private isPublicAuthConfig(value: unknown): value is PublicAuthConfig {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    if (
      ('version' in value &&
        value.version !== undefined &&
        value.version !== 1) ||
      ('enabled' in value &&
        value.enabled !== undefined &&
        typeof value.enabled !== 'boolean') ||
      ('provider' in value &&
        value.provider !== undefined &&
        value.provider !== 'privy') ||
      !('privyAppId' in value) ||
      (value.privyAppId !== null && typeof value.privyAppId !== 'string') ||
      !('loginMethods' in value) ||
      !Array.isArray(value.loginMethods) ||
      !value.loginMethods.every(method => this.isLoginMethod(method)) ||
      !('walletOnboarding' in value) ||
      typeof value.walletOnboarding !== 'object' ||
      value.walletOnboarding === null ||
      !('embeddedWallet' in value.walletOnboarding) ||
      typeof value.walletOnboarding.embeddedWallet !== 'boolean' ||
      !('externalWalletBinding' in value.walletOnboarding) ||
      typeof value.walletOnboarding.externalWalletBinding !== 'boolean'
    ) {
      return false;
    }
    return true;
  }

  private normalizeSnapshot(value: unknown): AuthProviderSnapshot {
    if (
      typeof value === 'object' &&
      value !== null &&
      'status' in value &&
      this.isProviderStatus(value.status) &&
      'loginMethods' in value &&
      Array.isArray(value.loginMethods) &&
      value.loginMethods.every(method => this.isLoginMethod(method)) &&
      (!('error' in value) ||
        value.error === undefined ||
        typeof value.error === 'string')
    ) {
      return {
        status: value.status,
        loginMethods: value.loginMethods,
        ...('error' in value && typeof value.error === 'string'
          ? { error: value.error }
          : {}),
      };
    }

    return {
      status: 'failed',
      loginMethods: this.publicConfig?.loginMethods ?? [],
      error: 'Account provider returned an invalid state.',
    };
  }

  private isProviderStatus(
    value: unknown
  ): value is AuthProviderSnapshot['status'] {
    return (
      typeof value === 'string' &&
      ['loading', 'ready', 'disabled', 'failed'].includes(value)
    );
  }

  private isLoginMethod(value: unknown): value is AuthProviderLoginMethod {
    return (
      typeof value === 'string' &&
      ['email', 'google', 'apple', 'passkey'].includes(value)
    );
  }

  private isRemoteModule(value: unknown): value is AuthProviderRemoteModule {
    return (
      typeof value === 'object' &&
      value !== null &&
      'mountAuthProvider' in value &&
      typeof value.mountAuthProvider === 'function'
    );
  }

  private isMountApi(value: unknown): value is AuthProviderMountApi {
    return (
      typeof value === 'object' &&
      value !== null &&
      'contractVersion' in value &&
      value.contractVersion === AUTH_PROVIDER_CONTRACT_VERSION &&
      'unmount' in value &&
      typeof value.unmount === 'function' &&
      'subscribe' in value &&
      typeof value.subscribe === 'function' &&
      'getSnapshot' in value &&
      typeof value.getSnapshot === 'function' &&
      'login' in value &&
      typeof value.login === 'function' &&
      'getAccessToken' in value &&
      typeof value.getAccessToken === 'function' &&
      'getUser' in value &&
      typeof value.getUser === 'function'
    );
  }

  private requireReadyProvider(): AuthProviderMountApi {
    if (!this.mountApi || this.snapshot.status !== 'ready') {
      throw new Error('Account provider is not ready.');
    }
    return this.mountApi;
  }

  private publish(snapshot: AuthProviderSnapshot): AuthProviderSnapshot {
    this.snapshotSubject.next(snapshot);
    return snapshot;
  }

  private withTimeout<T>(
    promise: Promise<T>,
    durationMs: number,
    message: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error(message)),
        durationMs
      );
      promise.then(
        value => {
          window.clearTimeout(timer);
          resolve(value);
        },
        error => {
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
}
