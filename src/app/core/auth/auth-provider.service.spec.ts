import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import {
  AuthProviderListener,
  AuthProviderMountApi,
  AuthProviderSnapshot,
} from '@mfe-contracts/auth-provider.types';
import {
  AUTH_PROVIDER_REMOTE_LOADER,
  AuthProviderRemoteLoader,
  AuthProviderService,
} from './auth-provider.service';
import { AppLoggerService } from '@core/logging/app-logger.service';
import {
  WALLET_REMOTE_EXPOSED_MODULES,
} from '@mfe-contracts/wallet-remote-entrypoints';

function mountApi(
  initialSnapshot: AuthProviderSnapshot,
  onSubscribe?: (listener: AuthProviderListener) => void
): AuthProviderMountApi {
  return {
    contractVersion: '2.0.0',
    unmount: jasmine.createSpy('unmount'),
    subscribe: listener => {
      onSubscribe?.(listener);
      listener(initialSnapshot);
      return jasmine.createSpy('unsubscribe');
    },
    getSnapshot: () => initialSnapshot,
    login: async () => ({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
      },
      wallets: [],
    }),
    getAccessToken: async () => 'provider-token',
    logout: async () => undefined,
  };
}

describe('AuthProviderService', () => {
  let service: AuthProviderService;
  let loader: jasmine.Spy<AuthProviderRemoteLoader>;
  let logger: jasmine.SpyObj<AppLoggerService>;

  beforeEach(() => {
    loader = jasmine.createSpy('loadAuthProviderRemote');
    logger = jasmine.createSpyObj<AppLoggerService>('AppLoggerService', [
      'log',
    ]);
    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_PROVIDER_REMOTE_LOADER, useValue: loader },
        { provide: AppLoggerService, useValue: logger },
      ],
    });
    service = TestBed.inject(AuthProviderService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('mounts the provider remote with only the generic backend location', async () => {
    const api = mountApi({
      status: 'ready',
      loginMethods: ['email', 'passkey'],
      embeddedWalletEnabled: true,
    });
    const mountAuthProvider = jasmine
      .createSpy('mountAuthProvider')
      .and.returnValue(api);
    loader.and.resolveTo({ mountAuthProvider });

    expect((await service.initialize()).status).toBe('ready');
    expect(mountAuthProvider).toHaveBeenCalledWith(jasmine.any(HTMLElement), {
      apiBaseUrl: environment.apiUrl,
    });
  });

  it('keeps the host on the thin auth-provider atom', () => {
    expect(WALLET_REMOTE_EXPOSED_MODULES.authProvider).toBe('./auth-provider');
    expect(WALLET_REMOTE_EXPOSED_MODULES.privyProvider).toBe(
      './providers/privy'
    );
  });

  it('keeps late provider readiness observable', async () => {
    let providerListener: AuthProviderListener | undefined;
    let notifySubscribed: (() => void) | undefined;
    const subscribed = new Promise<void>(resolve => {
      notifySubscribed = resolve;
    });
    const api = mountApi(
      { status: 'loading', loginMethods: [], embeddedWalletEnabled: false },
      listener => {
        providerListener = listener;
        notifySubscribed?.();
      }
    );
    loader.and.resolveTo({ mountAuthProvider: () => api });

    const initialized = service.initialize();
    await subscribed;

    expect(service.snapshot.status).toBe('loading');
    providerListener?.({
      status: 'ready',
      loginMethods: ['passkey'],
      embeddedWalletEnabled: true,
    });
    expect((await initialized).status).toBe('ready');
  });

  it('accepts a disabled state decided inside the MFE', async () => {
    const api = mountApi({
      status: 'disabled',
      loginMethods: [],
      embeddedWalletEnabled: false,
    });
    loader.and.resolveTo({ mountAuthProvider: () => api });

    expect((await service.initialize()).status).toBe('disabled');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('fails closed for an unsupported remote contract', async () => {
    loader.and.resolveTo({
      mountAuthProvider: () => ({ contractVersion: '1.0.0' }),
    });

    expect((await service.initialize()).status).toBe('failed');
    expect(service.snapshot.error).toContain('unsupported');
  });
});
