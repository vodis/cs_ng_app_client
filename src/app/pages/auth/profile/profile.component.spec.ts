/// <reference types="jasmine" />

import { BehaviorSubject, of } from 'rxjs';
import { Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';
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

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let walletsService: jasmine.SpyObj<WalletsService>;
  let walletGatewayBridge: jasmine.SpyObj<WalletGatewayBridgeService>;
  let router: jasmine.SpyObj<Router>;
  let localizedRouting: jasmine.SpyObj<LocalizedRoutingService>;
  let sessionSubject: BehaviorSubject<AuthSession | null>;
  let accountSubject: BehaviorSubject<
    { account: string; chainId: number | null } | undefined
  >;
  let lastConnectedSubject: BehaviorSubject<LastConnectedWallet | undefined>;

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
    sessionSubject = new BehaviorSubject<AuthSession | null>(disabledSession);
    accountSubject = new BehaviorSubject<
      { account: string; chainId: number | null } | undefined
    >(undefined);
    lastConnectedSubject = new BehaviorSubject<LastConnectedWallet | undefined>(
      undefined
    );
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

    const profile = new ProfileFacade(
      authSession,
      walletsService,
      walletGatewayBridge,
      router,
      localizedRouting
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

  it('shows a zero USD balance hero until wallets are funded', () => {
    expect(component.usdBalanceLabel()).toBe('$0.00');
    expect(component.usdChangeLabel()).toBe('+$0.00');
    expect(component.usdChangePercentLabel()).toBe('0.00%');
    expect(component.walletPillLabel()).toBe('No wallet');
    expect(component.showWalletSetupActions()).toBeTrue();
  });

  it('labels an embedded linked wallet in the balance hero', () => {
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

  it('shows a last-connected section after disconnect when wallet is not linked', () => {
    lastConnectedSubject.next({
      account: linkedWalletSession.wallets[0].address,
      chainId: null,
      walletType: 'embedded',
      source: 'privy',
      connectorId: 'privy',
    });

    expect(component.showLastConnectedSection()).toBeTrue();
    expect(
      component.isEmbeddedWallet(component.resolveLastConnectedWallet())
    ).toBeTrue();
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

  it('blocks removing embedded wallets', async () => {
    sessionSubject.next(linkedWalletSession);

    await component.deleteWallet(linkedWalletSession.wallets[0]);

    expect(authSession.deleteWallet).not.toHaveBeenCalled();
    expect(component.error).toContain('cannot be removed');
  });

  it('seeds last connected from primary linked wallet', () => {
    sessionSubject.next(linkedWalletSession);

    expect(walletsService.rememberConnectedWallet).toHaveBeenCalledWith(
      jasmine.objectContaining({
        account: linkedWalletSession.wallets[0].address,
        walletType: 'embedded',
      })
    );
    expect(component.showLastConnectedSection()).toBeTrue();
  });

  it('shows empty connect section only when there is no wallet history', () => {
    expect(component.showEmptyConnectSection()).toBeTrue();

    lastConnectedSubject.next({
      account: linkedWalletSession.wallets[0].address,
      chainId: null,
      walletType: 'embedded',
    });

    expect(component.showEmptyConnectSection()).toBeFalse();
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

  it('shows two sessions by default and the rest after See all', () => {
    expect(component.visibleLoginSessions.length).toBe(2);

    component.toggleSessions();

    expect(component.visibleLoginSessions.length).toBe(
      component.loginSessions.length
    );
    expect(component.showAllSessions).toBeTrue();
  });
});
