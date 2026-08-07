import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { environment } from '../../../environments/environment';
import { AuthProviderService } from './auth-provider.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { ProductEventsService } from '@core/product-events/product-events.service';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let httpMock: HttpTestingController;
  let router: { navigateByUrl: jasmine.Spy };
  let authProvider: jasmine.SpyObj<AuthProviderService>;
  let walletGatewayBridge: jasmine.SpyObj<WalletGatewayBridgeService>;
  let walletsService: jasmine.SpyObj<WalletsService>;
  let productEvents: jasmine.SpyObj<ProductEventsService>;
  let localizedRouting: jasmine.SpyObj<LocalizedRoutingService>;

  beforeEach(() => {
    router = { navigateByUrl: jasmine.createSpy('navigateByUrl') };
    authProvider = jasmine.createSpyObj<AuthProviderService>(
      'AuthProviderService',
      [
        'login',
        'sendEmailCode',
        'verifyEmailCode',
        'linkPasskey',
        'logout',
        'getAccessToken',
        'ensureEmbeddedWallet',
      ],
      {
        snapshot: {
          status: 'ready',
          loginMethods: ['email', 'passkey'],
          passkeyLoginEnabled: true,
          passkeySignupEnabled: false,
          passkeyLinkEnabled: true,
          embeddedWalletEnabled: true,
        },
      }
    );
    authProvider.login.and.resolveTo({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
        email: 'user@example.com',
        authMethod: 'email',
      },
      wallets: [],
    });
    authProvider.getAccessToken.and.resolveTo('provider-token');
    authProvider.sendEmailCode.and.resolveTo();
    authProvider.verifyEmailCode.and.resolveTo({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
        email: 'user@example.com',
        authMethod: 'email',
      },
      wallets: [],
    });
    authProvider.linkPasskey.and.resolveTo({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
        email: 'user@example.com',
        authMethod: 'email',
        passkeyEnabled: true,
      },
      wallets: [],
    });
    authProvider.logout.and.resolveTo();
    authProvider.ensureEmbeddedWallet.and.resolveTo({
      id: 'wallet-1',
      providerWalletId: 'provider-wallet-1',
      address: '0x1111111111111111111111111111111111111111',
      chainType: 'ethereum',
      walletType: 'embedded',
      isPrimary: true,
    });
    walletGatewayBridge = jasmine.createSpyObj<WalletGatewayBridgeService>(
      'WalletGatewayBridgeService',
      ['disconnectWallet', 'syncConnectedWallet']
    );
    walletGatewayBridge.syncConnectedWallet.and.resolveTo({
      status: 'connected',
      account: '0x1111111111111111111111111111111111111111',
      chainId: null,
      isVerified: false,
      safetyStatus: null,
      isBypassed: false,
      executionState: 'operating.idle',
    });
    walletsService = jasmine.createSpyObj<WalletsService>('WalletsService', [
      'setAccount',
    ]);
    productEvents = jasmine.createSpyObj<ProductEventsService>(
      'ProductEventsService',
      ['record', 'reason', 'message']
    );
    productEvents.reason.and.returnValue('test_error');
    productEvents.message.and.callFake((error: unknown) =>
      error instanceof Error ? error.message : undefined
    );
    localizedRouting = jasmine.createSpyObj<LocalizedRoutingService>(
      'LocalizedRoutingService',
      ['path']
    );
    localizedRouting.path.and.callFake(path =>
      path === '/' ? '/en' : `/en${path}`
    );

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthProviderService, useValue: authProvider },
        { provide: WalletGatewayBridgeService, useValue: walletGatewayBridge },
        { provide: WalletsService, useValue: walletsService },
        { provide: ProductEventsService, useValue: productEvents },
        { provide: LocalizedRoutingService, useValue: localizedRouting },
      ],
    });

    service = TestBed.inject(AuthSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('uses runtime auth config login methods', () => {
    expect(service.enabledLoginMethods).toEqual(['email', 'passkey']);
  });

  it('uses runtime passkey linking capability', () => {
    expect(service.passkeyLinkEnabled).toBeTrue();
  });

  it('logs in through the account provider without provider-specific host calls', fakeAsync(() => {
    let resolvedSession: unknown;

    service.login('email').then(session => {
      resolvedSession = session;
    });
    flushMicrotasks();
    expect(resolvedSession).toEqual({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
        email: 'user@example.com',
        authMethod: 'email',
      },
      wallets: [],
    });
    expect(service.session?.user.id).toBe('account-1');
  }));

  it('sends and verifies an email code through the account provider', fakeAsync(() => {
    let resolvedSession: unknown;

    service.sendEmailCode('user@example.com');
    service.verifyEmailCode('user@example.com', '123456').then(session => {
      resolvedSession = session;
    });
    flushMicrotasks();

    expect(authProvider.sendEmailCode).toHaveBeenCalledOnceWith(
      'user@example.com'
    );
    expect(authProvider.verifyEmailCode).toHaveBeenCalledOnceWith({
      email: 'user@example.com',
      code: '123456',
    });
    expect(resolvedSession).toEqual({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
        email: 'user@example.com',
        authMethod: 'email',
      },
      wallets: [],
    });
    expect(service.session?.user.authMethod).toBe('email');
  }));

  it('enables passkey through the account provider and updates the session', fakeAsync(() => {
    let resolvedSession: unknown;

    service.enablePasskey().then(session => {
      resolvedSession = session;
    });
    flushMicrotasks();

    expect(authProvider.linkPasskey).toHaveBeenCalledTimes(1);
    expect(resolvedSession).toEqual({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
        email: 'user@example.com',
        authMethod: 'email',
        passkeyEnabled: true,
      },
      wallets: [],
    });
    expect(service.session?.user.passkeyEnabled).toBeTrue();
  }));

  it('logs out through the provider and clears host wallet state', fakeAsync(() => {
    service.login('email');
    flushMicrotasks();
    expect(service.session?.user.id).toBe('account-1');

    service.logout();
    flushMicrotasks();

    expect(authProvider.logout).toHaveBeenCalledTimes(1);
    expect(walletGatewayBridge.disconnectWallet).toHaveBeenCalledTimes(1);
    expect(walletsService.setAccount).toHaveBeenCalledOnceWith(undefined);
    expect(service.session).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/en/login');
  }));

  it('syncs the wallet gateway after ensuring an embedded wallet', fakeAsync(() => {
    service.ensureEmbeddedWallet();
    flushMicrotasks();

    expect(authProvider.ensureEmbeddedWallet).toHaveBeenCalledTimes(1);
    expect(walletGatewayBridge.syncConnectedWallet).toHaveBeenCalledTimes(1);
  }));

  it('refreshes session and wallets using the provider access token', fakeAsync(() => {
    let resolvedSession: unknown;

    service.refresh().then(session => {
      resolvedSession = session;
    });
    flushMicrotasks();

    const me = httpMock.expectOne(`${environment.apiUrl}/api/v1/me`);
    const wallets = httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`);
    expect(me.request.headers.get('Authorization')).toBe(
      'Bearer provider-token'
    );
    expect(wallets.request.headers.get('Authorization')).toBe(
      'Bearer provider-token'
    );
    me.flush({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
      },
    });
    wallets.flush({ wallets: [] });
    flushMicrotasks();

    expect(resolvedSession).toEqual({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
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
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
      },
    });
    httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`).flush({
      wallets: [
        {
          id: 'wallet-1',
          providerWalletId: 'wallet-1',
          address: '0x1111111111111111111111111111111111111111',
          chainType: 'ethereum',
          walletType: 'embedded',
          source: 'provider',
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
      'Bearer provider-token'
    );
    setPrimary.flush({
      wallet: {
        id: 'wallet-1',
        providerWalletId: 'wallet-1',
        address: '0x1111111111111111111111111111111111111111',
        chainType: 'ethereum',
        walletType: 'embedded',
        source: 'provider',
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
          providerWalletId: 'wallet-1',
          address: '0x1111111111111111111111111111111111111111',
          chainType: 'ethereum',
          walletType: 'embedded',
          source: 'provider',
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
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
      },
    });
    httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`).flush({
      wallets: [
        {
          id: 'wallet-1',
          providerWalletId: 'wallet-1',
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
      'Bearer provider-token'
    );
    deleted.flush({});
    flushMicrotasks();
    const reload = httpMock.expectOne(`${environment.apiUrl}/api/v1/wallets`);
    reload.flush({ wallets: [] });
    flushMicrotasks();

    expect(service.session?.wallets).toEqual([]);
  }));

  it('loads balances using the provider access token', fakeAsync(() => {
    let resolvedBalances: unknown;

    service.loadBalances().then(balances => {
      resolvedBalances = balances;
    });
    flushMicrotasks();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/balances`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer provider-token'
    );
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
