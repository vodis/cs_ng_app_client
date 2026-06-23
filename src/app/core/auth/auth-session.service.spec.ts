import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { environment } from '../../../environments/environment';
import type { CraftscriptPrivyBridge } from '@core/privy/privy-bridge.types';

function bridge(): CraftscriptPrivyBridge {
  return {
    login: async () => ({ email: { address: 'user@example.com' } }),
    getAccessToken: async () => 'privy-token',
    getUser: async () => ({ email: { address: 'user@example.com' } }),
    getEmbeddedWallet: async () => ({
      id: 'wallet-1',
      address: '0x1111111111111111111111111111111111111111',
      chainType: 'ethereum',
      walletClientType: 'embedded',
    }),
    signMessage: async () => ({ signature: '0xsig' }),
    sendTransaction: async () => ({ hash: '0xhash' }),
  };
}

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let httpMock: HttpTestingController;
  let router: { navigateByUrl: jasmine.Spy };

  beforeEach(() => {
    delete window.craftscriptPrivy;
    delete window.craftscriptPrivyConfig;
    router = { navigateByUrl: jasmine.createSpy('navigateByUrl') };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: Router, useValue: router }],
    });

    service = TestBed.inject(AuthSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    delete window.craftscriptPrivy;
    delete window.craftscriptPrivyConfig;
  });

  it('uses runtime auth config login methods', () => {
    window.craftscriptPrivyConfig = {
      privyAppId: 'privy-app-id',
      loginMethods: ['email', 'passkey'],
      walletOnboarding: {
        embeddedWallet: true,
        externalWalletBinding: true,
      },
    };

    expect(service.enabledLoginMethods).toEqual(['email', 'passkey']);
  });

  it('logs in through the Privy bridge and creates a backend session', fakeAsync(() => {
    window.craftscriptPrivy = bridge();
    let resolvedSession: unknown;

    service.login('email').then(session => {
      resolvedSession = session;
    });
    flushMicrotasks();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/privy/session`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer privy-token');
    expect(req.request.body).toEqual({
      email: 'user@example.com',
      authMethod: 'email',
      wallet: {
        privyWalletId: 'wallet-1',
        address: '0x1111111111111111111111111111111111111111',
        chainType: 'ethereum',
        walletType: 'embedded',
        source: 'privy',
        isPrimary: true,
      },
    });
    req.flush({
      user: {
        id: 'account-1',
        privyUserId: 'did:privy:user-1',
        sessionId: 'session-1',
        email: 'user@example.com',
        authMethod: 'email',
      },
      wallets: [],
    });
    flushMicrotasks();

    expect(resolvedSession).toEqual({
      user: {
        id: 'account-1',
        privyUserId: 'did:privy:user-1',
        sessionId: 'session-1',
        email: 'user@example.com',
        authMethod: 'email',
      },
      wallets: [],
    });
    expect(service.session?.user.id).toBe('account-1');
  }));

  it('refreshes session and wallets using the Privy access token', fakeAsync(() => {
    window.craftscriptPrivy = bridge();
    let resolvedSession: unknown;

    service.refresh().then(session => {
      resolvedSession = session;
    });
    flushMicrotasks();

    const me = httpMock.expectOne(`${environment.apiUrl}/api/v1/me`);
    const wallets = httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`);
    expect(me.request.headers.get('Authorization')).toBe('Bearer privy-token');
    expect(wallets.request.headers.get('Authorization')).toBe('Bearer privy-token');
    me.flush({
      user: {
        id: 'account-1',
        privyUserId: 'did:privy:user-1',
        sessionId: 'session-1',
      },
    });
    wallets.flush({ wallets: [] });
    flushMicrotasks();

    expect(resolvedSession).toEqual({
      user: {
        id: 'account-1',
        privyUserId: 'did:privy:user-1',
        sessionId: 'session-1',
      },
      wallets: [],
    });
  }));

  it('sets a primary wallet and reloads wallet state', fakeAsync(() => {
    window.craftscriptPrivy = bridge();
    service.refresh();
    flushMicrotasks();

    httpMock.expectOne(`${environment.apiUrl}/api/v1/me`).flush({
      user: {
        id: 'account-1',
        privyUserId: 'did:privy:user-1',
        sessionId: 'session-1',
      },
    });
    httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`).flush({
      wallets: [
        {
          id: 'wallet-1',
          privyWalletId: 'wallet-1',
          address: '0x1111111111111111111111111111111111111111',
          chainType: 'ethereum',
          walletType: 'embedded',
          source: 'privy',
          status: 'active',
          isPrimary: false,
          deletedAt: null,
        },
      ],
    });
    flushMicrotasks();

    service.setPrimaryWallet('wallet-1');
    flushMicrotasks();

    const setPrimary = httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets/wallet-1/primary`);
    expect(setPrimary.request.method).toBe('PATCH');
    expect(setPrimary.request.headers.get('Authorization')).toBe('Bearer privy-token');
    setPrimary.flush({
      wallet: {
        id: 'wallet-1',
        privyWalletId: 'wallet-1',
        address: '0x1111111111111111111111111111111111111111',
        chainType: 'ethereum',
        walletType: 'embedded',
        source: 'privy',
        status: 'active',
        isPrimary: true,
        deletedAt: null,
      },
    });
    flushMicrotasks();
    const reload = httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`);
    reload.flush({
      wallets: [
        {
          id: 'wallet-1',
          privyWalletId: 'wallet-1',
          address: '0x1111111111111111111111111111111111111111',
          chainType: 'ethereum',
          walletType: 'embedded',
          source: 'privy',
          status: 'active',
          isPrimary: true,
          deletedAt: null,
        },
      ],
    });
    flushMicrotasks();

    expect(service.session?.wallets[0].isPrimary).toBeTrue();
  }));

  it('deletes a wallet and reloads wallet state', fakeAsync(() => {
    window.craftscriptPrivy = bridge();
    service.refresh();
    flushMicrotasks();

    httpMock.expectOne(`${environment.apiUrl}/api/v1/me`).flush({
      user: {
        id: 'account-1',
        privyUserId: 'did:privy:user-1',
        sessionId: 'session-1',
      },
    });
    httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`).flush({
      wallets: [
        {
          id: 'wallet-1',
          privyWalletId: 'wallet-1',
          address: '0x1111111111111111111111111111111111111111',
          chainType: 'ethereum',
          walletType: 'embedded',
          isPrimary: true,
        },
      ],
    });
    flushMicrotasks();

    service.deleteWallet('wallet-1');
    flushMicrotasks();

    const deleted = httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets/wallet-1`);
    expect(deleted.request.method).toBe('DELETE');
    expect(deleted.request.headers.get('Authorization')).toBe('Bearer privy-token');
    deleted.flush({});
    flushMicrotasks();
    const reload = httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`);
    reload.flush({ wallets: [] });
    flushMicrotasks();

    expect(service.session?.wallets).toEqual([]);
  }));
});
