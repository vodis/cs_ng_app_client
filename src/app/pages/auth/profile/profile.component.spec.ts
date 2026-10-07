import type { SwapSettlementResult } from '@mfe-contracts/swap-review.types';
import {
  ActiveWalletFacade,
  type ActiveWalletState,
} from '@domains/wallet/application/active-wallet.facade';
/// <reference types="jasmine" />

import { BehaviorSubject, Subject, combineLatest, map, of } from 'rxjs';
import { ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession, BackendWallet } from '@core/auth/auth-session.types';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import { LastConnectedWallet } from '@domains/wallet/models/wallet.models';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import {
  MockProfileActivitySource,
  PROFILE_ACTIVITY_EXAMPLE_DATE,
} from './profile-activity.source';
import { ProfileComponent } from './profile.component';
import { ProfileFacade } from './profile.facade';
import { PortfolioApiService } from '../../portfolio/portfolio-api.service';

describe('ProfileComponent', () => {
  let activeWallet: jasmine.SpyObj<ActiveWalletFacade>;
  let component: ProfileComponent;
  let settlementSubject: Subject<SwapSettlementResult>;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let walletsService: jasmine.SpyObj<WalletsService>;
  let walletGatewayBridge: jasmine.SpyObj<WalletGatewayBridgeService>;
  let router: jasmine.SpyObj<Router>;
  let localizedRouting: jasmine.SpyObj<LocalizedRoutingService>;
  let portfolioApi: jasmine.SpyObj<PortfolioApiService>;
  let sessionSubject: BehaviorSubject<AuthSession | null>;
  let accountSubject: BehaviorSubject<
    { account: string; chainId: number | null } | undefined
  >;
  let lastConnectedSubject: BehaviorSubject<LastConnectedWallet | undefined>;
  let swapSubmittedSubject: BehaviorSubject<
    { traceId: string; intentHash: string } | undefined
  >;

  it('initializes the rendered portfolio label when no wallet or network is selected', () => {
    const total = document.createElement('span');
    total.textContent = 'Loading…';
    Object.assign(component, { usdBalanceValue: new ElementRef(total) });
    component.activeAccount = null;
    component.ngAfterViewInit();
    expect(total.textContent).toBe('Select a wallet');
    component.activeAccount = '0xabc';
    component.activeNetwork = undefined;
    component.ngAfterViewInit();
    expect(total.textContent).toBe('Select a network');
  });

  const enabledSession: AuthSession = {
    user: {
      id: 'account-1',
      providerUserId: 'provider-1',
      sessionId: 'session-1',
      email: 'user@example.com',
      authMethod: 'email',
      passkeyEnabled: true,
    },
    wallets: [],
  };

  const disabledSession: AuthSession = {
    user: {
      ...enabledSession.user,
      passkeyEnabled: false,
    },
    wallets: [],
  };

  const linkedWalletSession: AuthSession = {
    ...enabledSession,
    wallets: [
      {
        id: 'wallet-1',
        providerWalletId: 'provider-wallet-1',
        address: '0x6e1a000000000000000000000000000000007690',
        chainType: 'ethereum',
        walletType: 'embedded',
        source: 'provider',
        isPrimary: true,
      },
    ],
  };

  const externalWalletSession: AuthSession = {
    ...enabledSession,
    wallets: [
      {
        id: 'wallet-2',
        providerWalletId: 'provider-wallet-2',
        address: '0xabc000000000000000000000000000000000def0',
        chainType: 'ethereum',
        walletType: 'external',
        source: 'metamask',
        isPrimary: true,
      },
    ],
  };

  beforeEach(() => {
    settlementSubject = new Subject<SwapSettlementResult>();
    sessionSubject = new BehaviorSubject<AuthSession | null>(disabledSession);
    accountSubject = new BehaviorSubject<
      { account: string; chainId: number | null } | undefined
    >(undefined);
    lastConnectedSubject = new BehaviorSubject<LastConnectedWallet | undefined>(
      undefined
    );
    swapSubmittedSubject = new BehaviorSubject<
      { traceId: string; intentHash: string } | undefined
    >(undefined);
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      [
        'enablePasskey',
        'ensureEmbeddedWallet',
        'reloadWallets',
        'loadBalances',
        'setPrimaryWallet',
        'deleteWallet',
        'requestDeletion',
        'logout',
      ],
      {
        session$: sessionSubject.asObservable(),
        loading$: of(false),
        passkeyLinkEnabled: true,
        passkeyLoginEnabled: true,
      }
    );
    authSession.enablePasskey.and.resolveTo(enabledSession);
    authSession.loadBalances.and.resolveTo([]);
    walletsService = jasmine.createSpyObj<WalletsService>(
      'WalletsService',
      ['requestOpen', 'requestClose', 'setAccount', 'rememberConnectedWallet'],
      {
        account: accountSubject,
        lastConnected: lastConnectedSubject,
        swapSubmitted: swapSubmittedSubject,
        swapSettled: settlementSubject,
      }
    );
    walletGatewayBridge = jasmine.createSpyObj<WalletGatewayBridgeService>(
      'WalletGatewayBridgeService',
      ['syncConnectedWallet', 'disconnectWallet']
    );
    walletGatewayBridge.syncConnectedWallet.and.resolveTo({
      status: 'connected',
      account: linkedWalletSession.wallets[0].address,
      chainId: null,
      isVerified: false,
      safetyStatus: null,
      isBypassed: false,
      executionState: 'operating.idle',
    });
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    router.navigateByUrl.and.resolveTo(true);
    localizedRouting = jasmine.createSpyObj<LocalizedRoutingService>(
      'LocalizedRoutingService',
      ['path']
    );
    localizedRouting.path.and.callFake((path: string) =>
      path === '/' ? '/en' : `/en${path}`
    );
    portfolioApi = jasmine.createSpyObj<PortfolioApiService>(
      'PortfolioApiService',
      ['loadPortfolio']
    );
    portfolioApi.loadPortfolio.and.resolveTo({
      asOf: null,
      valuationCurrency: 'USD',
      totalValue: '0',
      unpricedPositionCount: 0,
      positions: [],
    });

    activeWallet = jasmine.createSpyObj<ActiveWalletFacade>(
      'ActiveWalletFacade',
      ['refreshBalances', 'revalidateBalances', 'requestConnection'],
      {
        state: {
          wallet: linkedWalletSession.wallets[0],
          connected: false,
          canRequestSwap: false,
          reason: 'Reconnect',
        },
        state$: combineLatest([sessionSubject, accountSubject]).pipe(
          map(
            ([session, account]): ActiveWalletState => ({
              session: session ?? undefined,
              wallet:
                session?.wallets.find(wallet => wallet.isPrimary) ??
                session?.wallets[0],
              network:
                session?.wallets[0]?.chainType === 'near'
                  ? 'near:mainnet'
                  : account?.chainId
                    ? `eip155:${account.chainId}`
                    : undefined,
              connected: Boolean(account),
              canRequestSwap: Boolean(account),
              reason: '',
              snapshot: account
                ? {
                    ...account,
                    status: 'connected',
                    isVerified: true,
                    safetyStatus: 'safe',
                    isBypassed: false,
                    executionState: 'operating.idle',
                  }
                : undefined,
            })
          )
        ),
        balances$: of({ status: 'idle', rows: [], account: '', network: '' }),
      }
    );
    activeWallet.requestConnection.and.callFake(() =>
      walletsService.requestOpen()
    );
    const profile = new ProfileFacade(
      authSession,
      walletsService,
      walletGatewayBridge,
      router,
      localizedRouting,
      portfolioApi,
      activeWallet
    );
    component = new ProfileComponent(profile, new MockProfileActivitySource());
    component.ngOnInit();
  });

  it('allows enabling passkey when it is not enabled', async () => {
    expect(component.canEnablePasskey()).toBeTrue();

    await component.enablePasskey();

    expect(authSession.enablePasskey).toHaveBeenCalledTimes(1);
    expect(component.passkeyMessage).toBe('Passkey authentication enabled');
  });

  it('hides passkey enablement when linking is disabled', () => {
    Object.defineProperty(authSession, 'passkeyLinkEnabled', {
      configurable: true,
      get: () => false,
    });

    expect(component.canEnablePasskey()).toBeFalse();
  });

  it('shows linked-only messaging when passkey login is unavailable', () => {
    sessionSubject.next(enabledSession);
    Object.defineProperty(authSession, 'passkeyLoginEnabled', {
      configurable: true,
      get: () => false,
    });

    expect(component.isPasskeyLinked()).toBeTrue();
    expect(component.isPasskeyLoginAvailable()).toBeFalse();
  });

  it('treats linked backend wallets as connected for the wallet CTA', () => {
    expect(component.hasLinkedWallets()).toBeFalse();

    sessionSubject.next(linkedWalletSession);

    expect(component.hasLinkedWallets()).toBeTrue();
  });

  it('shows mock swap volume beside a GitHub-style activity heatmap', () => {
    const example = component.activity.weeks
      .flatMap(week => week.days)
      .find(day => day.isoDate === PROFILE_ACTIVITY_EXAMPLE_DATE);

    expect(component.activityVolumeLabel()).toBe('$978.51');
    expect(component.activityFiatLabel()).toBe('≈ $978.66');
    expect(component.activityTodayLabel()).toBe('+$17.98 (1.87%)');
    expect(component.isActivityTodayUp()).toBeTrue();
    expect(component.activity.weeks.length).toBe(53);
    expect(component.activity.years).toEqual([2026, 2025, 2024]);
    expect(component.activity.selectedYear).toBe(2026);
    expect(example).toBeDefined();
    if (!example) {
      fail('example heatmap day was missing');
      return;
    }

    expect(component.heatmapDayTooltip(example)).toBe(
      '5 swaps and 1 deposit on Apr 23, 2026'
    );
  });

  it('switches the activity heatmap to a past calendar year', () => {
    component.selectHeatmapYear(2025);

    const inRangeDays = component.activity.weeks
      .flatMap(week => week.days)
      .filter(day => day.inRange);

    expect(component.activity.selectedYear).toBe(2025);
    expect(inRangeDays[0].isoDate).toBe('2025-01-01');
    expect(inRangeDays[inRangeDays.length - 1].isoDate).toBe('2025-12-31');
  });

  it('routes Activity Pay and Analyze AI, and opens the wallet for Receive', async () => {
    await component.openActivityPay();
    expect(localizedRouting.path).toHaveBeenCalledWith('/');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/en');

    await component.openActivityAnalyze();
    expect(localizedRouting.path).toHaveBeenCalledWith('/portfolio');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/en/portfolio');

    await component.openActivityReceive();
    expect(walletsService.requestOpen).toHaveBeenCalled();
  });

  it('does not claim a zero portfolio before a wallet is selected', () => {
    expect(component.usdBalanceLabel()).toBe('Select a wallet');
    expect(component.usdChangeLabel()).toBe('+$0.00');
    expect(component.usdChangePercentLabel()).toBe('0.00%');
    expect(component.walletPillLabel()).toBe('No wallet');
    expect(component.showWalletSetupActions()).toBeTrue();
  });

  it('renders the BFF portfolio total in the balance hero', async () => {
    component.activeAccount = 'alice.near';
    component.activeNetwork = 'near:mainnet';
    portfolioApi.loadPortfolio.and.resolveTo({
      asOf: '2026-08-19T12:00:00Z',
      valuationCurrency: 'USD',
      totalValue: '125.5',
      unpricedPositionCount: 0,
      positions: [
        {
          walletRef: 'wallet-ref',
          chain: 'near:mainnet',
          assetId: 'near:native',
          symbol: 'NEAR',
          quantity: '50.125',
          priceUsd: '2.503740648379052369',
          valueUsd: '125.5',
          allocationPercent: '100',
          priceUpdatedAt: '2026-08-19T12:00:00Z',
          balanceUpdatedAt: '2026-08-19T12:00:00Z',
        },
      ],
    });

    await component.refreshPortfolio();

    expect(portfolioApi.loadPortfolio).toHaveBeenCalled();
    expect(component.usdBalanceLabel()).toBe('$125.50');
    expect(component.tokenBalanceLabel()).toBe('50.125 NEAR');
  });

  it('shows an unavailable state when portfolio valuation fails', async () => {
    component.activeAccount = 'alice.near';
    component.activeNetwork = 'near:mainnet';
    portfolioApi.loadPortfolio.and.rejectWith(new Error('RPC unavailable'));

    await component.refreshPortfolio();

    expect(component.portfolio).toBeNull();
    expect(component.usdBalanceLabel()).toBe('Unavailable');
  });

  it('keeps a per-token stale marker in the mobile network meta', () => {
    const fresh = {
      walletId: 'wallet-1',
      walletAddress: 'alice.near',
      chainType: 'near',
      network: 'near:mainnet',
      assetId: 'near:native',
      symbol: 'NEAR',
      balanceRaw: '1',
      balanceDecimal: '1',
      decimals: 24,
      source: 'bff',
      fetchedAt: '2026-08-19T12:00:00Z',
      expiresAt: '2026-08-19T12:30:00Z',
      stale: false,
    };
    const stale = { ...fresh, symbol: 'USDC', assetId: 'usdc', stale: true };

    expect(component.balanceNetworkMeta(fresh)).toBe('NEAR');
    expect(component.balanceNetworkMeta(stale)).toBe('NEAR · stale');
    expect(component.balanceMeta(stale)).toContain('stale /');
  });

  it('cancels the previous CountUp before starting a new balance animation', () => {
    const el = document.createElement('span');
    (
      component as unknown as {
        usdBalanceValue?: { nativeElement: HTMLElement };
      }
    ).usdBalanceValue = { nativeElement: el };

    (
      component as unknown as { animateBalanceTo: (value: number) => void }
    ).animateBalanceTo(10);
    const first = (
      component as unknown as {
        balanceCountUp: { onDestroy: () => void } | null;
      }
    ).balanceCountUp;
    expect(first).not.toBeNull();
    const destroy = spyOn(first!, 'onDestroy').and.callThrough();

    (
      component as unknown as { animateBalanceTo: (value: number) => void }
    ).animateBalanceTo(20);

    expect(destroy).toHaveBeenCalled();
    expect(
      (component as unknown as { balanceCountUp: object | null }).balanceCountUp
    ).not.toBe(first);
  });

  it('keeps Unavailable when portfolio fails during a balance animation', async () => {
    component.activeAccount = 'alice.near';
    component.activeNetwork = 'near:mainnet';
    const el = document.createElement('span');
    (
      component as unknown as {
        usdBalanceValue?: { nativeElement: HTMLElement };
      }
    ).usdBalanceValue = { nativeElement: el };
    (
      component as unknown as { animateBalanceTo: (value: number) => void }
    ).animateBalanceTo(125.5);
    expect(
      (component as unknown as { balanceCountUp: object | null }).balanceCountUp
    ).not.toBeNull();

    portfolioApi.loadPortfolio.and.rejectWith(new Error('RPC unavailable'));
    await component.refreshPortfolio();

    expect(el.textContent).toBe('Unavailable');
    expect(
      (component as unknown as { balanceCountUp: object | null }).balanceCountUp
    ).toBeNull();
  });

  it('cancels an active balance animation on destroy', () => {
    const el = document.createElement('span');
    (
      component as unknown as {
        usdBalanceValue?: { nativeElement: HTMLElement };
      }
    ).usdBalanceValue = { nativeElement: el };
    (
      component as unknown as { animateBalanceTo: (value: number) => void }
    ).animateBalanceTo(42);
    const active = (
      component as unknown as {
        balanceCountUp: { onDestroy: () => void } | null;
      }
    ).balanceCountUp;
    expect(active).not.toBeNull();
    const destroy = spyOn(active!, 'onDestroy').and.callThrough();

    component.ngOnDestroy();

    expect(destroy).toHaveBeenCalled();
    expect(
      (component as unknown as { balanceCountUp: object | null }).balanceCountUp
    ).toBeNull();
  });

  it('ignores a stale portfolio response after a newer request completes', async () => {
    component.activeAccount = 'alice.near';
    component.activeNetwork = 'near:mainnet';
    await Promise.resolve();
    let resolveFirst!: (
      value: Awaited<ReturnType<PortfolioApiService['loadPortfolio']>>
    ) => void;
    let resolveSecond!: (
      value: Awaited<ReturnType<PortfolioApiService['loadPortfolio']>>
    ) => void;
    const first = new Promise<
      Awaited<ReturnType<PortfolioApiService['loadPortfolio']>>
    >(resolve => {
      resolveFirst = resolve;
    });
    const second = new Promise<
      Awaited<ReturnType<PortfolioApiService['loadPortfolio']>>
    >(resolve => {
      resolveSecond = resolve;
    });
    portfolioApi.loadPortfolio.and.returnValues(first, second);

    const olderRequest = component.refreshPortfolio();
    component.activeAccount = 'bob.near';
    const newerRequest = component.refreshPortfolio();
    resolveSecond({
      asOf: null,
      valuationCurrency: 'USD',
      totalValue: '20',
      unpricedPositionCount: 0,
      positions: [],
    });
    await newerRequest;
    resolveFirst({
      asOf: null,
      valuationCurrency: 'USD',
      totalValue: '10',
      unpricedPositionCount: 0,
      positions: [],
    });
    await olderRequest;

    expect(component.usdBalanceLabel()).toBe('$20.00');
  });

  it('requests live mainnet valuation for a connected .tg account', async () => {
    component.activeAccount = 'alice.near';
    component.activeNetwork = 'near:mainnet';
    sessionSubject.next({
      ...disabledSession,
      wallets: [
        {
          ...externalWalletSession.wallets[0],
          address: 'alice.tg',
          chainType: 'near',
        },
      ],
    });
    await Promise.resolve();

    expect(portfolioApi.loadPortfolio).toHaveBeenCalledWith({
      walletAddress: 'alice.tg',
      network: 'near:mainnet',
    });
  });

  it('does not refetch portfolio for the same session and account', async () => {
    component.activeAccount = 'alice.near';
    component.activeNetwork = 'near:mainnet';
    await component.ensurePortfolioLoaded();
    const callsAfterInit = portfolioApi.loadPortfolio.calls.count();

    sessionSubject.next(disabledSession);
    accountSubject.next(undefined);
    await Promise.resolve();

    expect(portfolioApi.loadPortfolio.calls.count()).toBe(callsAfterInit);
  });

  it('reuses portfolio cache when a new session object arrives for the same user/account', async () => {
    component.activeAccount = 'alice.near';
    component.activeNetwork = 'near:mainnet';
    await Promise.resolve();
    const callsAfterInit = portfolioApi.loadPortfolio.calls.count();
    expect(callsAfterInit).toBe(0);

    sessionSubject.next({
      user: { ...disabledSession.user },
      wallets: [...disabledSession.wallets],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(portfolioApi.loadPortfolio.calls.count()).toBe(callsAfterInit);
  });

  it('forces a portfolio reload only from an explicit balances refresh', async () => {
    component.activeAccount = 'alice.near';
    component.activeNetwork = 'near:mainnet';
    await Promise.resolve();
    const callsAfterInit = portfolioApi.loadPortfolio.calls.count();

    await component.refreshBalances();

    expect(portfolioApi.loadPortfolio.calls.count()).toBe(callsAfterInit + 1);
  });

  it('refetches portfolio after a completed swap', async () => {
    component.activeAccount = 'alice.near';
    component.activeNetwork = 'near:mainnet';
    await Promise.resolve();
    const callsAfterInit = portfolioApi.loadPortfolio.calls.count();

    settlementSubject.next({
      traceId: 'trace-1',
      status: 'SUCCESS',
    });
    await Promise.resolve();

    expect(portfolioApi.loadPortfolio.calls.count()).toBe(callsAfterInit + 1);
  });

  it('labels an embedded linked wallet for onboarding', () => {
    sessionSubject.next(linkedWalletSession);

    expect(component.walletPillLabel()).toBe('CraftScript wallet');
    expect(component.showWalletSetupActions()).toBeFalse();
  });

  it('generates an embedded wallet from onboarding', async () => {
    authSession.ensureEmbeddedWallet.and.resolveTo();
    authSession.reloadWallets.and.resolveTo(linkedWalletSession.wallets);

    await component.generateWallet();

    expect(authSession.ensureEmbeddedWallet).toHaveBeenCalledTimes(1);
    expect(authSession.reloadWallets).toHaveBeenCalledTimes(1);
    expect(component.walletMessage).toBe('Wallet generated');
  });

  it('counts remaining onboarding steps and progress from wallet and passkey state', () => {
    expect(component.completedSwapCount()).toBe(
      component.activity.completedSwapCount
    );
    expect(component.onboardingRemainingCount()).toBe(2);
    expect(component.onboardingProgressPercent()).toBe(33);
    expect(component.nextOnboardingCta()).toBe('Set up wallet');
    expect(component.nextOnboardingTitle()).toBe('Connect or generate wallet');
    expect(component.showOnboardingGenerateWallet()).toBeTrue();

    sessionSubject.next(enabledSession);

    expect(component.onboardingRemainingCount()).toBe(1);
    expect(component.onboardingProgressPercent()).toBe(67);
    expect(component.nextOnboardingCta()).toBe('Set up wallet');

    sessionSubject.next(linkedWalletSession);

    expect(component.onboardingRemainingCount()).toBe(0);
    expect(component.onboardingProgressPercent()).toBe(100);
    expect(component.nextOnboardingCta()).toBe('Go to Exchange');
    expect(component.showOnboardingGenerateWallet()).toBeFalse();
    expect(component.onboardingRemainingLabel()).toBe('All steps complete');
  });

  it('opens the wallet modal for the next wallet onboarding step', async () => {
    await component.runOnboardingStep();

    expect(walletGatewayBridge.syncConnectedWallet).toHaveBeenCalledTimes(1);
    expect(walletsService.requestOpen).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('enables passkey from the security onboarding step', async () => {
    sessionSubject.next(linkedWalletSession);
    component.session = {
      ...linkedWalletSession,
      user: { ...linkedWalletSession.user, passkeyEnabled: false },
    };

    const securityStep = component
      .onboardingSteps()
      .find(step => step.id === 'security');

    expect(securityStep).toBeDefined();
    if (!securityStep) {
      fail('security onboarding step was missing');
      return;
    }

    await component.runOnboardingStep(securityStep);

    expect(authSession.enablePasskey).toHaveBeenCalledTimes(1);
  });

  it('routes swap onboarding to Exchange', async () => {
    sessionSubject.next(linkedWalletSession);

    await component.runOnboardingStep();

    expect(localizedRouting.path).toHaveBeenCalledWith('/');
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/en');
  });

  it('syncs the connected wallet then opens the wallets MFE', async () => {
    await component.openWalletModal();

    expect(walletGatewayBridge.syncConnectedWallet).toHaveBeenCalledTimes(1);
    expect(walletsService.requestOpen).toHaveBeenCalledTimes(1);
  });

  it('still opens the wallets MFE when sync fails', async () => {
    walletGatewayBridge.syncConnectedWallet.and.rejectWith(
      new Error('gateway unavailable')
    );

    await component.openWalletModal();

    expect(walletsService.requestOpen).toHaveBeenCalledTimes(1);
  });

  it('disconnects through the wallet gateway and remembers the last wallet', async () => {
    accountSubject.next({
      account: linkedWalletSession.wallets[0].address,
      chainId: 1,
    });
    sessionSubject.next(linkedWalletSession);

    await component.disconnectWallet();

    expect(walletsService.rememberConnectedWallet).toHaveBeenCalled();
    expect(walletGatewayBridge.disconnectWallet).toHaveBeenCalledTimes(1);
    expect(walletsService.setAccount).toHaveBeenCalledOnceWith(undefined);
    expect(walletsService.requestClose).toHaveBeenCalledTimes(1);
    expect(component.walletMessage).toBe('Wallet disconnected');
  });

  it('ignores browser history for wallets absent from the authenticated account', () => {
    lastConnectedSubject.next({
      account: linkedWalletSession.wallets[0].address,
      chainId: null,
      walletType: 'embedded',
      source: 'privy',
      connectorId: 'privy',
    });

    expect(component.showLastConnectedSection()).toBeFalse();

    expect(
      component.canRemoveLinkedWallet(linkedWalletSession.wallets[0])
    ).toBeFalse();
  });

  it('keeps reconnect available when the remembered wallet is linked', () => {
    sessionSubject.next(linkedWalletSession);
    lastConnectedSubject.next({
      account: linkedWalletSession.wallets[0].address,
      chainId: null,
      walletType: 'embedded',
      source: 'privy',
      connectorId: 'privy',
    });

    expect(component.showLastConnectedSection()).toBeTrue();
  });

  it('omits provider details from last connected copy', () => {
    sessionSubject.next(linkedWalletSession);
    lastConnectedSubject.next({
      account: linkedWalletSession.wallets[0].address,
      chainId: null,
      walletType: 'embedded',
      source: 'privy',
      connectorId: 'privy',
    });

    const meta = component.lastConnectedMeta(
      component.resolveLastConnectedWallet()!
    );

    expect(meta).toBe('Ethereum • Embedded');
  });

  it('resolves chain logos for linked wallets', () => {
    expect(component.walletChainIcon('ethereum')).toContain('1027.png');
    expect(component.walletChainIcon('near')).toContain('6535.png');
    expect(component.walletChainIcon('ton')).toContain('11419.png');
    expect(component.walletChainIcon('unknown')).toBe('');

    sessionSubject.next(linkedWalletSession);
    lastConnectedSubject.next({
      account: linkedWalletSession.wallets[0].address,
      chainId: null,
      walletType: 'embedded',
      source: 'privy',
      connectorId: 'privy',
    });

    expect(
      component.lastConnectedChainIcon(component.resolveLastConnectedWallet()!)
    ).toContain('1027.png');
  });

  it('shows reconnect and allows removal for external wallets', () => {
    sessionSubject.next(externalWalletSession);
    lastConnectedSubject.next({
      account: externalWalletSession.wallets[0].address,
      chainId: null,
      walletType: 'external',
      source: 'metamask',
      connectorId: 'metamask',
    });

    expect(component.showLastConnectedSection()).toBeTrue();
    expect(
      component.isEmbeddedWallet(component.resolveLastConnectedWallet())
    ).toBeFalse();
    expect(
      component.canRemoveLinkedWallet(externalWalletSession.wallets[0])
    ).toBeTrue();
  });

  it('shows last connected for a disconnected wallet not in the linked list', () => {
    sessionSubject.next(linkedWalletSession);
    lastConnectedSubject.next({
      account: '0xdifferent0000000000000000000000000000001',
      chainId: null,
      walletType: 'external',
      source: 'metamask',
      connectorId: 'metamask',
    });

    expect(component.showLastConnectedSection()).toBeTrue();
  });

  it('reconnects by syncing without opening the wallets MFE', async () => {
    activeWallet.state.connected = true;
    await component.reconnectWallet();

    expect(walletGatewayBridge.syncConnectedWallet).toHaveBeenCalledTimes(1);
    expect(walletsService.setAccount).toHaveBeenCalled();
    expect(walletsService.rememberConnectedWallet).toHaveBeenCalled();
    expect(walletsService.requestOpen).not.toHaveBeenCalled();
    expect(component.walletMessage).toBe('Wallet reconnected');
  });

  it('opens the wallets MFE when reconnect sync returns no account', async () => {
    walletGatewayBridge.syncConnectedWallet.and.resolveTo({
      status: 'disconnected',
      account: null,
      chainId: null,
      isVerified: false,
      safetyStatus: null,
      isBypassed: false,
      executionState: 'operating.idle',
    });

    await component.reconnectWallet();

    expect(walletsService.setAccount).not.toHaveBeenCalled();
    expect(walletsService.requestOpen).toHaveBeenCalledTimes(1);
  });

  it('opens the wallets MFE and sets an error when reconnect sync fails', async () => {
    walletGatewayBridge.syncConnectedWallet.and.rejectWith(
      new Error('gateway unavailable')
    );

    await component.reconnectWallet();

    expect(component.error).toBe('gateway unavailable');
    expect(walletsService.requestOpen).toHaveBeenCalledTimes(1);
  });

  it('opens the wallets MFE without sync when connecting another wallet', () => {
    component.connectAnotherWallet();

    expect(walletGatewayBridge.syncConnectedWallet).not.toHaveBeenCalled();
    expect(walletsService.requestOpen).toHaveBeenCalledTimes(1);
  });

  it('blocks competing wallet mutations until activation finishes', async () => {
    let finish: ((wallet: BackendWallet) => void) | undefined;
    authSession.setPrimaryWallet.and.returnValue(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    const wallet = { ...externalWalletSession.wallets[0], isPrimary: false };
    const pending = component.setPrimaryWallet(wallet);
    await component.setPrimaryWallet({ ...wallet, id: 'other' });
    await component.deleteWallet(wallet);
    expect(authSession.setPrimaryWallet).toHaveBeenCalledTimes(1);
    expect(authSession.deleteWallet).not.toHaveBeenCalled();
    finish?.(wallet);
    await pending;
    expect(component.busyWalletId).toBe('');
  });

  it('blocks removing embedded wallets', async () => {
    sessionSubject.next(linkedWalletSession);

    await component.deleteWallet(linkedWalletSession.wallets[0]);

    expect(authSession.deleteWallet).not.toHaveBeenCalled();
    expect(component.error).toContain('cannot be removed');
  });

  it('resolves the backend primary wallet without rewriting browser history', () => {
    sessionSubject.next(linkedWalletSession);
    expect(walletsService.rememberConnectedWallet).not.toHaveBeenCalled();
    expect(component.resolveLastConnectedWallet()?.account).toBe(
      linkedWalletSession.wallets[0].address
    );
    expect(component.showLastConnectedSection()).toBeTrue();
  });

  it('shows connect when browser history does not belong to the account', () => {
    expect(component.showEmptyConnectSection()).toBeTrue();

    lastConnectedSubject.next({
      account: linkedWalletSession.wallets[0].address,
      chainId: null,
      walletType: 'embedded',
    });

    expect(component.showEmptyConnectSection()).toBeTrue();
  });

  it('treats a live account as connected', () => {
    expect(component.isLiveConnected()).toBeFalse();

    accountSubject.next({
      account: linkedWalletSession.wallets[0].address,
      chainId: 1,
    });

    expect(component.isLiveConnected()).toBeTrue();
    expect(component.showLastConnectedSection()).toBeFalse();
  });
});
