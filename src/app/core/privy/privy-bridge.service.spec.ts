import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PrivyBridgeService } from './privy-bridge.service';
import { environment } from '../../../environments/environment';
import type { CraftscriptPrivyBridge } from './privy-bridge.types';
import { PRIVY_SOURCE_READY_EVENT } from './privy-host-bridge';

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

  beforeEach(() => {
    delete window.craftscriptPrivy;
    delete window.craftscriptPrivySource;
    delete window.craftscriptPrivyConfig;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
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
  });

  it('fetches and exposes enabled public Privy config', async () => {
    const initialized = service.initialize();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/public/auth-config`
    );
    req.flush({
      privyAppId: 'privy-app-id',
      loginMethods: ['email', 'google', 'passkey'],
      walletOnboarding: {
        embeddedWallet: true,
        externalWalletBinding: true,
      },
    });

    await initialized;

    expect(window.craftscriptPrivyConfig).toEqual({
      privyAppId: 'privy-app-id',
      loginMethods: ['email', 'google', 'passkey'],
      walletOnboarding: {
        embeddedWallet: true,
        externalWalletBinding: true,
      },
    });
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
});
