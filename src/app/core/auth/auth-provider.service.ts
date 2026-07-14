import { Inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';
import { BehaviorSubject } from 'rxjs';
import {
  AUTH_PROVIDER_CONTRACT_VERSION,
  AuthProviderLoginMethod,
  AuthProviderMountApi,
  AuthProviderRemoteModule,
  AuthProviderSession,
  AuthProviderSnapshot,
} from '@mfe-contracts/auth-provider.types';
import {
  WALLET_REMOTE_EXPOSED_MODULES,
  WALLET_REMOTE_NAME,
} from '@mfe-contracts/wallet-remote-entrypoints';
import { environment } from '../../../environments/environment';
import { AppLoggerService } from '@core/logging/app-logger.service';

const REMOTE_LOAD_TIMEOUT_MS = 15_000;
const INITIAL_SNAPSHOT: AuthProviderSnapshot = {
  status: 'loading',
  loginMethods: [],
  passkeyLoginEnabled: false,
  passkeySignupEnabled: false,
  passkeyLinkEnabled: false,
  embeddedWalletEnabled: false,
};

export type AuthProviderRemoteLoader = () => Promise<unknown>;

export const AUTH_PROVIDER_REMOTE_LOADER =
  new InjectionToken<AuthProviderRemoteLoader>('AUTH_PROVIDER_REMOTE_LOADER', {
    providedIn: 'root',
    factory: () => () =>
      loadRemoteModule({
        type: 'manifest',
        remoteName: WALLET_REMOTE_NAME,
        exposedModule: WALLET_REMOTE_EXPOSED_MODULES.authProvider,
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

  readonly snapshot$ = this.snapshotSubject.asObservable();

  constructor(
    @Inject(AUTH_PROVIDER_REMOTE_LOADER)
    private readonly loadRemote: AuthProviderRemoteLoader,
    private readonly logger: AppLoggerService
  ) {}

  get snapshot(): AuthProviderSnapshot {
    return this.snapshotSubject.value;
  }

  initialize(): Promise<AuthProviderSnapshot> {
    this.initialization ??= this.start();
    return this.initialization;
  }

  whenSettled(): Promise<AuthProviderSnapshot> {
    return this.initialize();
  }

  login(method: AuthProviderLoginMethod): Promise<AuthProviderSession> {
    return this.requireReadyProvider().login(method);
  }

  sendEmailCode(email: string): Promise<void> {
    return this.requireReadyProvider().sendEmailCode(email);
  }

  verifyEmailCode(input: {
    email: string;
    code: string;
  }): Promise<AuthProviderSession> {
    return this.requireReadyProvider().verifyEmailCode(input);
  }

  linkPasskey(): Promise<AuthProviderSession> {
    return this.requireReadyProvider().linkPasskey();
  }

  logout(): Promise<void> {
    return this.mountApi?.logout() ?? Promise.resolve();
  }

  getAccessToken(): Promise<string | null> {
    return this.mountApi?.getAccessToken() ?? Promise.resolve(null);
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

      const api = loadedModule.mountAuthProvider(this.container, {
        apiBaseUrl: environment.apiUrl,
      });
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
        loginMethods: [],
        passkeyLoginEnabled: false,
        passkeySignupEnabled: false,
        passkeyLinkEnabled: false,
        embeddedWalletEnabled: false,
        error: errorMessage,
      });
    }
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
      'embeddedWalletEnabled' in value &&
      typeof value.embeddedWalletEnabled === 'boolean' &&
      (!('error' in value) ||
        value.error === undefined ||
        typeof value.error === 'string')
    ) {
      const passkeyLoginEnabled = this.optionalBoolean(
        value,
        'passkeyLoginEnabled',
        value.loginMethods.includes('passkey')
      );
      const passkeySignupEnabled = false;
      const passkeyLinkEnabled = this.optionalBoolean(
        value,
        'passkeyLinkEnabled',
        value.loginMethods.includes('passkey')
      );

      return {
        status: value.status,
        loginMethods: value.loginMethods,
        passkeyLoginEnabled,
        passkeySignupEnabled,
        passkeyLinkEnabled,
        embeddedWalletEnabled: value.embeddedWalletEnabled,
        ...('error' in value && typeof value.error === 'string'
          ? { error: value.error }
          : {}),
      };
    }

    return {
      status: 'failed',
      loginMethods: [],
      passkeyLoginEnabled: false,
      passkeySignupEnabled: false,
      passkeyLinkEnabled: false,
      embeddedWalletEnabled: false,
      error: 'Account provider returned an invalid state.',
    };
  }

  private optionalBoolean(
    value: object,
    key: 'passkeyLoginEnabled' | 'passkeySignupEnabled' | 'passkeyLinkEnabled',
    fallback: boolean
  ): boolean {
    const record = value as Record<string, unknown>;
    if (!(key in value)) {
      return fallback;
    }
    return typeof record[key] === 'boolean' ? record[key] : fallback;
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
      'sendEmailCode' in value &&
      typeof value.sendEmailCode === 'function' &&
      'verifyEmailCode' in value &&
      typeof value.verifyEmailCode === 'function' &&
      'linkPasskey' in value &&
      typeof value.linkPasskey === 'function' &&
      'logout' in value &&
      typeof value.logout === 'function' &&
      'getAccessToken' in value &&
      typeof value.getAccessToken === 'function'
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
