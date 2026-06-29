import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
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

function mountApi(
  initialSnapshot: AuthProviderSnapshot,
  onSubscribe?: (listener: AuthProviderListener) => void
): AuthProviderMountApi {
  return {
    contractVersion: '1.0.0',
    unmount: jasmine.createSpy('unmount'),
    subscribe: listener => {
      onSubscribe?.(listener);
      listener(initialSnapshot);
      return jasmine.createSpy('unsubscribe');
    },
    getSnapshot: () => initialSnapshot,
    login: async () => ({ id: 'did:privy:user-1' }),
    getAccessToken: async () => 'privy-token',
    getUser: async () => ({ id: 'did:privy:user-1' }),
  };
}

describe('AuthProviderService', () => {
  let service: AuthProviderService;
  let httpMock: HttpTestingController;
  let loader: jasmine.Spy<AuthProviderRemoteLoader>;
  let logger: jasmine.SpyObj<AppLoggerService>;

  beforeEach(() => {
    loader = jasmine.createSpy('loadAuthProviderRemote');
    logger = jasmine.createSpyObj<AppLoggerService>('AppLoggerService', [
      'log',
    ]);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AUTH_PROVIDER_REMOTE_LOADER, useValue: loader },
        { provide: AppLoggerService, useValue: logger },
      ],
    });
    service = TestBed.inject(AuthProviderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.ngOnDestroy();
    httpMock.verify();
  });

  it('loads enabled config and resolves when the provider is ready', async () => {
    const api = mountApi({
      status: 'ready',
      loginMethods: ['email', 'passkey'],
    });
    loader.and.resolveTo({ mountAuthProvider: () => api });

    const initialized = service.initialize();
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/public/auth-config`)
      .flush({
        version: 1,
        enabled: true,
        provider: 'privy',
        privyAppId: 'privy-app-id',
        loginMethods: ['email', 'passkey'],
        walletOnboarding: {
          embeddedWallet: true,
          externalWalletBinding: true,
        },
      });

    expect((await initialized).status).toBe('ready');
    expect(service.snapshot.status).toBe('ready');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps late provider readiness observable', async () => {
    let providerListener: AuthProviderListener | undefined;
    let notifySubscribed: (() => void) | undefined;
    const subscribed = new Promise<void>(resolve => {
      notifySubscribed = resolve;
    });
    const api = mountApi(
      { status: 'loading', loginMethods: ['passkey'] },
      listener => {
        providerListener = listener;
        notifySubscribed?.();
      }
    );
    loader.and.resolveTo({ mountAuthProvider: () => api });

    const initialized = service.initialize();
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/public/auth-config`)
      .flush({
        privyAppId: 'privy-app-id',
        loginMethods: ['passkey'],
        walletOnboarding: {
          embeddedWallet: true,
          externalWalletBinding: true,
        },
      });
    await subscribed;

    expect(service.snapshot.status).toBe('loading');
    providerListener?.({ status: 'ready', loginMethods: ['passkey'] });
    expect((await initialized).status).toBe('ready');
  });

  it('does not load the remote when auth is disabled', async () => {
    const initialized = service.initialize();
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/public/auth-config`)
      .flush({
        version: 1,
        enabled: false,
        provider: 'privy',
        privyAppId: null,
        loginMethods: [],
        walletOnboarding: {
          embeddedWallet: false,
          externalWalletBinding: false,
        },
      });

    expect((await initialized).status).toBe('disabled');
    expect(loader).not.toHaveBeenCalled();
  });

  it('fails closed for an unsupported remote contract', async () => {
    loader.and.resolveTo({
      mountAuthProvider: () => ({ contractVersion: '2.0.0' }),
    });
    const initialized = service.initialize();
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/public/auth-config`)
      .flush({
        privyAppId: 'privy-app-id',
        loginMethods: ['email'],
        walletOnboarding: {
          embeddedWallet: true,
          externalWalletBinding: true,
        },
      });

    expect((await initialized).status).toBe('failed');
    expect(service.snapshot.error).toContain('unsupported');
  });
});
