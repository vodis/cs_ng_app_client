import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { environment } from '../../../environments/environment';
import { of } from 'rxjs';
import {
  AuthProviderGateway,
  type AuthProviderState,
} from './auth-provider.gateway';

const readyState: AuthProviderState = {
  status: 'ready',
  loginMethods: ['email', 'google', 'apple', 'passkey'],
};

function configureReadyProvider(
  provider: jasmine.SpyObj<AuthProviderGateway>
): void {
  provider.login.and.resolveTo({ email: { address: 'user@example.com' } });
  provider.getAccessToken.and.resolveTo('privy-token');
  provider.getUser.and.resolveTo({ email: { address: 'user@example.com' } });
  provider.getEmbeddedWallet.and.resolveTo({
    id: 'wallet-1',
    address: '0x1111111111111111111111111111111111111111',
    chainType: 'ethereum',
    walletClientType: 'embedded',
  });
}

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let httpMock: HttpTestingController;
  let router: { navigateByUrl: jasmine.Spy };
  let authProvider: jasmine.SpyObj<AuthProviderGateway>;

  beforeEach(() => {
    router = { navigateByUrl: jasmine.createSpy('navigateByUrl') };
    authProvider = jasmine.createSpyObj<AuthProviderGateway>(
      'AuthProviderGateway',
      ['initialize', 'login', 'getAccessToken', 'getUser', 'getEmbeddedWallet'],
      { state: readyState, state$: of(readyState) }
    );
    configureReadyProvider(authProvider);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthProviderGateway, useValue: authProvider },
      ],
    });

    service = TestBed.inject(AuthSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('uses runtime auth config login methods', () => {
    const state: AuthProviderState = {
      status: 'ready',
      loginMethods: ['email', 'passkey'],
    };
    Object.defineProperty(authProvider, 'state', { get: () => state });

    expect(service.enabledLoginMethods).toEqual(['email', 'passkey']);
  });

  it('forwards each selected login method to the Privy bridge', fakeAsync(() => {
    const methods = ['email', 'google', 'apple', 'passkey'] as const;
    for (const method of methods) {
      service.login(method);
      flushMicrotasks();

      expect(authProvider.login).toHaveBeenCalledWith(method);
      httpMock
        .expectOne(`${environment.apiUrl}/api/v1/auth/privy/session`)
        .flush({
          user: {
            id: `account-${method}`,
            privyUserId: `did:privy:${method}`,
            sessionId: `session-${method}`,
            authMethod: method,
          },
          wallets: [],
        });
      flushMicrotasks();
    }
  }));

  it('logs in through the Privy bridge and creates a backend session', fakeAsync(() => {
    let resolvedSession: unknown;

    service.login('email').then(session => {
      resolvedSession = session;
    });
    flushMicrotasks();

    expect(authProvider.login).toHaveBeenCalledWith('email');

    const req = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/auth/privy/session`
    );
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
    let resolvedSession: unknown;

    service.refresh().then(session => {
      resolvedSession = session;
    });
    flushMicrotasks();

    const me = httpMock.expectOne(`${environment.apiUrl}/api/v1/me`);
    const wallets = httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`);
    expect(me.request.headers.get('Authorization')).toBe('Bearer privy-token');
    expect(wallets.request.headers.get('Authorization')).toBe(
      'Bearer privy-token'
    );
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

    const setPrimary = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/wallets/wallet-1/primary`
    );
    expect(setPrimary.request.method).toBe('PATCH');
    expect(setPrimary.request.headers.get('Authorization')).toBe(
      'Bearer privy-token'
    );
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

    const deleted = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/wallets/wallet-1`
    );
    expect(deleted.request.method).toBe('DELETE');
    expect(deleted.request.headers.get('Authorization')).toBe(
      'Bearer privy-token'
    );
    deleted.flush({});
    flushMicrotasks();
    const reload = httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`);
    reload.flush({ wallets: [] });
    flushMicrotasks();

    expect(service.session?.wallets).toEqual([]);
  }));

  it('loads balances using the Privy access token', fakeAsync(() => {
    let resolvedBalances: unknown;

    service.loadBalances().then(balances => {
      resolvedBalances = balances;
    });
    flushMicrotasks();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/balances`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer privy-token');
    req.flush({
      data: [
        {
          walletId: 'wallet-1',
          walletAddress: '0x1111111111111111111111111111111111111111',
          chainType: 'near',
          assetId: 'nep141:usdc.near',
          symbol: 'USDC',
          decimals: 6,
          balanceRaw: '1250000',
          balanceDecimal: '1.25',
          source: 'postgres_cache',
          fetchedAt: '2026-06-23T12:00:00.000Z',
          expiresAt: '2026-06-23T12:01:00.000Z',
        },
      ],
      meta: {
        source: 'postgres_cache',
        cached: true,
        fetchedAt: '2026-06-23T12:00:00.000Z',
      },
    });
    flushMicrotasks();

    expect(resolvedBalances).toEqual([
      {
        walletId: 'wallet-1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        chainType: 'near',
        assetId: 'nep141:usdc.near',
        symbol: 'USDC',
        decimals: 6,
        balanceRaw: '1250000',
        balanceDecimal: '1.25',
        source: 'postgres_cache',
        fetchedAt: '2026-06-23T12:00:00.000Z',
        expiresAt: '2026-06-23T12:01:00.000Z',
      },
    ]);
  }));
});
