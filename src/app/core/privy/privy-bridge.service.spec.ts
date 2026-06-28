import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PrivyBridgeService } from './privy-bridge.service';
import { environment } from '../../../environments/environment';
import type {
  CraftscriptPrivyBridge,
  PublicAuthConfig,
} from './privy-bridge.types';
import { PRIVY_SOURCE_READY_EVENT } from './privy-host-bridge';
import {
  PRIVY_RUNTIME_MOUNTER,
  type PrivyRuntimeMounter,
} from './privy-runtime';

function bridge(): CraftscriptPrivyBridge {
  return {
    login: async () => undefined,
    getAccessToken: async () => null,
    getUser: async () => null,
    getEmbeddedWallet: async () => null,
    signMessage: async () => ({ signature: '0xsig' }),
    sendTransaction: async () => ({ hash: '0xhash' }),
  };
}

describe('PrivyBridgeService', () => {
  let service: PrivyBridgeService;
  let httpMock: HttpTestingController;
  let mountRuntime: jasmine.Spy<PrivyRuntimeMounter>;
  let destroyRuntime: jasmine.Spy;

  beforeEach(() => {
    delete window.craftscriptPrivy;
    delete window.craftscriptPrivySource;

    destroyRuntime = jasmine.createSpy('destroyRuntime');
    mountRuntime = jasmine.createSpy<PrivyRuntimeMounter>('mountRuntime');
    mountRuntime.and.resolveTo({ destroy: destroyRuntime });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: PRIVY_RUNTIME_MOUNTER, useValue: mountRuntime }],
    });

    service = TestBed.inject(PrivyBridgeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.ngOnDestroy();
    httpMock.verify();
    delete window.craftscriptPrivy;
    delete window.craftscriptPrivySource;
  });

  it('fetches and exposes enabled public Privy config', async () => {
    const enabledConfig: PublicAuthConfig = {
      privyAppId: 'privy-app-id',
      loginMethods: ['email', 'google', 'passkey'],
      walletOnboarding: {
        embeddedWallet: true,
        externalWalletBinding: true,
      },
    };
    const initialized = service.initialize();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/public/auth-config`
    );
    req.flush(enabledConfig);

    await initialized;

    expect(service.state.loginMethods).toEqual(enabledConfig.loginMethods);
    expect(service.state.status).toBe('loading');
    expect(mountRuntime).toHaveBeenCalledWith(
      enabledConfig,
      jasmine.any(Function)
    );
  });

  it('does not expose disabled public Privy config', async () => {
    const initialized = service.initialize();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/public/auth-config`
    );
    req.flush({
      privyAppId: null,
      loginMethods: [],
      walletOnboarding: {
        embeddedWallet: false,
        externalWalletBinding: false,
      },
    });

    await initialized;

    expect(service.state).toEqual({ status: 'disabled', loginMethods: [] });
    expect(mountRuntime).not.toHaveBeenCalled();
  });

  it('adopts an existing Privy bridge source', async () => {
    const source = bridge();
    window.craftscriptPrivySource = source;

    const initialized = service.initialize();
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/public/auth-config`)
      .flush({
        privyAppId: null,
        loginMethods: [],
        walletOnboarding: {
          embeddedWallet: false,
          externalWalletBinding: false,
        },
      });

    await initialized;

    expect(window.craftscriptPrivy).toBe(source);
    expect(service.state.status).toBe('ready');
    expect(mountRuntime).not.toHaveBeenCalled();
  });

  it('adopts a Privy bridge source that becomes ready after startup', async () => {
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

    await initialized;

    const source = bridge();
    window.craftscriptPrivySource = source;
    window.dispatchEvent(new Event(PRIVY_SOURCE_READY_EVENT));

    expect(window.craftscriptPrivy).toBe(source);
    expect(service.state.status).toBe('ready');
  });

  it('keeps a ready external bridge when the local runtime later fails', async () => {
    let rejectRuntime: ((error: Error) => void) | undefined;
    mountRuntime.and.returnValue(
      new Promise((_resolve, reject) => {
        rejectRuntime = reject;
      })
    );

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

    const source = bridge();
    window.craftscriptPrivySource = source;
    window.dispatchEvent(new Event(PRIVY_SOURCE_READY_EVENT));
    rejectRuntime?.(new Error('Local runtime failed'));
    await initialized;

    expect(window.craftscriptPrivy).toBe(source);
    expect(service.state.status).toBe('ready');
    expect(service.state.error).toBeUndefined();
  });

  it('publishes the bridge produced by the Privy runtime', async () => {
    let publishBridge: ((source: CraftscriptPrivyBridge) => void) | undefined;
    mountRuntime.and.callFake(async (_config, onReady) => {
      publishBridge = onReady;
      return { destroy: destroyRuntime };
    });

    const initialized = service.initialize();
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/public/auth-config`)
      .flush({
        privyAppId: 'privy-app-id',
        loginMethods: ['google'],
        walletOnboarding: {
          embeddedWallet: true,
          externalWalletBinding: true,
        },
      });

    await initialized;

    const source = bridge();
    expect(publishBridge).toBeDefined();
    publishBridge?.(source);

    expect(window.craftscriptPrivySource).toBe(source);
    expect(window.craftscriptPrivy).toBe(source);
    expect(service.state.status).toBe('ready');
    expect(service.state.error).toBeUndefined();
  });

  it('exposes an actionable status when the Privy runtime fails', async () => {
    mountRuntime.and.rejectWith(new Error('SDK initialization failed'));

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

    await initialized;

    expect(service.state).toEqual({
      status: 'failed',
      loginMethods: ['email'],
      error: 'Account provider failed to start.',
    });
  });

  it('fails provider startup without blocking the host when config is unavailable', async () => {
    const initialized = service.initialize();
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/public/auth-config`)
      .flush('unavailable', { status: 503, statusText: 'Unavailable' });

    await initialized;

    expect(service.state).toEqual({
      status: 'failed',
      loginMethods: ['email'],
      error: 'Account login configuration is unavailable.',
    });
    expect(mountRuntime).not.toHaveBeenCalled();
  });
});
