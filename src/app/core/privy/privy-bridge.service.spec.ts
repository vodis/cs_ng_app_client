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
    delete window.craftscriptPrivyConfig;
    delete window.craftscriptPrivyError;

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
    delete window.craftscriptPrivyConfig;
    delete window.craftscriptPrivyError;
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

    expect(window.craftscriptPrivyConfig).toEqual(enabledConfig);
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

    expect(window.craftscriptPrivyConfig).toBeUndefined();
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
    expect(window.craftscriptPrivyError).toBeUndefined();
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

    expect(window.craftscriptPrivyError).toBe(
      'Account provider failed to start.'
    );
  });
});
