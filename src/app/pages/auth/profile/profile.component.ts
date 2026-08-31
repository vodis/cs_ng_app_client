import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import type {
  AuthSession,
  BackendBalance,
  BackendWallet,
} from '@core/auth/auth-session.types';
import { LastConnectedWallet } from '@domains/wallet/models/wallet.models';
import {
  formatActivityDayTooltip,
  type ActivityHeatmapDay,
  type ActivityHeatmapWeek,
} from '@shared/utils/activity-heatmap.utils';
import { EXCHANGE_TOKEN_ICON_URLS } from '@shared/utils/token-avatar.utils';
import {
  MockProfileActivitySource,
  ProfileActivitySource,
  type ProfileActivitySnapshot,
} from './profile-activity.source';
import {
  ProfileFacade,
  type ProfileOnboardingStep,
  type ProfileOnboardingViewModel,
} from './profile.facade';

const CHAIN_ICON_URLS: Record<string, string> = {
  ethereum: EXCHANGE_TOKEN_ICON_URLS['ETH'],
  near: EXCHANGE_TOKEN_ICON_URLS['NEAR'],
  ton: 'https://s2.coinmarketcap.com/static/img/coins/128x128/11419.png',
};

type ProfileLoginSession = {
  status: 'Active' | 'Revoked';
  issued: string;
  endDate: string;
  organization: string;
  authentication: string;
  application: string;
};

const REQUIRED_SWAP_COUNT = 5;

function formatUsdAmount(value: number): string {
  return value.toFixed(2);
}

const MOCK_LOGIN_SESSIONS: ProfileLoginSession[] = [
  {
    status: 'Active',
    issued: 'Aug 13, 2026, 11:56 AM',
    endDate: 'Aug 20, 2026, 11:56 AM',
    organization: 'CraftScript',
    authentication: 'Google OAuth',
    application: 'NEAR Intents Partner Portal',
  },
  {
    status: 'Revoked',
    issued: 'Aug 13, 2026, 11:23 AM',
    endDate: 'Aug 20, 2026, 11:23 AM',
    organization: '137372',
    authentication: 'Google OAuth',
    application: 'NEAR Intents Partner Portal',
  },
  {
    status: 'Revoked',
    issued: 'Aug 12, 2026, 6:41 PM',
    endDate: 'Aug 19, 2026, 6:41 PM',
    organization: 'CraftScript',
    authentication: 'Google OAuth',
    application: 'NEAR Intents Partner Portal',
  },
];

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  providers: [
    ProfileFacade,
    { provide: ProfileActivitySource, useClass: MockProfileActivitySource },
  ],
})
export class ProfileComponent implements OnInit, OnDestroy {
  public session: AuthSession | null = null;
  public deletionMessage = '';
  public walletMessage = '';
  public balanceMessage = '';
  public passkeyMessage = '';
  public error = '';
  public busyWalletId = '';
  public passkeyLoading = false;
  public balances: BackendBalance[] = [];
  public balancesLoading = false;
  public connectedAccount: string | null = null;
  public lastConnectedWallet: LastConnectedWallet | null = null;
  public walletActionBusy = false;
  public walletLoading = false;
  public showAllSessions = false;
  public readonly loginSessions = MOCK_LOGIN_SESSIONS;
  public visibleLoginSessions = MOCK_LOGIN_SESSIONS.slice(0, 2);

  public readonly requiredSwapCount = REQUIRED_SWAP_COUNT;
  public activity: ProfileActivitySnapshot;
  public onboarding: ProfileOnboardingViewModel;

  private subscription?: Subscription;

  constructor(
    public readonly profile: ProfileFacade,
    private readonly activitySource: ProfileActivitySource
  ) {
    this.activity = this.activitySource.snapshot();
    this.onboarding = this.buildOnboardingViewModel();
  }

  public ngOnInit(): void {
    this.subscription = new Subscription();
    this.subscription.add(
      this.profile.session$.subscribe(session => {
        this.session = session;
        if (session) {
          this.seedLastConnectedFromBackend(session.wallets);
          void this.refreshBalances();
        } else {
          this.balances = [];
        }
        this.refreshOnboarding();
      })
    );
    this.subscription.add(
      this.profile.account$.subscribe(account => {
        this.connectedAccount = account?.account ?? null;
        this.refreshOnboarding();
      })
    );
    this.subscription.add(
      this.profile.lastConnected$.subscribe(wallet => {
        this.lastConnectedWallet = wallet ?? null;
        this.refreshOnboarding();
      })
    );
  }

  public ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  public toggleSessions(): void {
    this.showAllSessions = !this.showAllSessions;
    this.visibleLoginSessions = this.showAllSessions
      ? this.loginSessions
      : this.loginSessions.slice(0, 2);
  }

  public trackByLoginSession(
    _index: number,
    login: ProfileLoginSession
  ): string {
    return [login.status, login.issued, login.organization].join('|');
  }

  public shortAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  public walletMeta(wallet: BackendWallet): string {
    const chain = this.capitalizeLabel(wallet.chainType);
    const kind = this.isEmbeddedWallet(wallet) ? 'Embedded' : 'External';
    return [chain, kind].filter(Boolean).join(' • ');
  }

  public lastConnectedMeta(wallet: LastConnectedWallet): string {
    const chain = this.capitalizeLabel(this.lastConnectedChainType(wallet));
    const kind = this.isEmbeddedWallet(wallet) ? 'Embedded' : 'External';
    return [chain, kind].filter(Boolean).join(' • ');
  }

  public walletChainIcon(chainType: string | null | undefined): string {
    return CHAIN_ICON_URLS[String(chainType || '').toLowerCase()] ?? '';
  }

  public lastConnectedChainIcon(wallet: LastConnectedWallet): string {
    return this.walletChainIcon(this.lastConnectedChainType(wallet));
  }

  public balanceAmount(balance: BackendBalance): string {
    const amount =
      balance.balanceDecimal ||
      this.rawToDecimal(balance.balanceRaw, balance.decimals);
    return `${amount} ${balance.symbol}`;
  }

  public balanceMeta(balance: BackendBalance): string {
    const expiry = new Date(balance.expiresAt);
    const expiresAt = Number.isNaN(expiry.getTime())
      ? 'cache'
      : `cache until ${expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const freshness = balance.stale ? 'stale / ' : '';
    return `${this.shortAddress(balance.walletAddress)} / ${balance.network} / ${freshness}${expiresAt}`;
  }

  public canEnablePasskey(): boolean {
    return this.profile.passkeyLinkEnabled;
  }

  public isPasskeyLinked(): boolean {
    return this.session?.user.passkeyEnabled === true;
  }

  public isPasskeyLoginAvailable(): boolean {
    return this.profile.passkeyLoginEnabled;
  }

  public async enablePasskey(): Promise<void> {
    this.error = '';
    this.passkeyMessage = '';
    this.passkeyLoading = true;
    try {
      await this.profile.enablePasskey();
      this.passkeyMessage = 'Passkey authentication enabled';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Passkey enablement failed';
    } finally {
      this.passkeyLoading = false;
    }
  }

  public hasLinkedWallets(): boolean {
    return (this.session?.wallets.length ?? 0) > 0;
  }

  public showWalletSetupActions(): boolean {
    return !this.hasLinkedWallets();
  }

  public completedSwapCount(): number {
    return this.activity.completedSwapCount;
  }

  public isWalletStepDone(): boolean {
    return (
      this.onboarding.steps.find(step => step.id === 'wallet')?.done ?? false
    );
  }

  public isSecurityStepDone(): boolean {
    return (
      this.onboarding.steps.find(step => step.id === 'security')?.done ?? false
    );
  }

  public isSwapsStepDone(): boolean {
    return (
      this.onboarding.steps.find(step => step.id === 'swaps')?.done ?? false
    );
  }

  public onboardingSteps(): ProfileOnboardingStep[] {
    return this.onboarding.steps;
  }

  public onboardingRemainingCount(): number {
    return this.onboarding.remainingCount;
  }

  public onboardingProgressPercent(): number {
    return this.onboarding.progressPercent;
  }

  public nextOnboardingStep(): ProfileOnboardingStep | null {
    return this.onboarding.nextStep;
  }

  public nextOnboardingCta(): string {
    return this.onboarding.nextCta;
  }

  public nextOnboardingTitle(): string {
    return this.onboarding.nextTitle;
  }

  public onboardingRemainingLabel(): string {
    return this.onboarding.remainingLabel;
  }

  public showOnboardingGenerateWallet(): boolean {
    return this.nextOnboardingStep()?.id === 'wallet';
  }

  public isCurrentOnboardingStep(step: ProfileOnboardingStep): boolean {
    return this.nextOnboardingStep()?.id === step.id;
  }

  public trackByOnboardingStep(
    _index: number,
    step: ProfileOnboardingStep
  ): string {
    return step.id;
  }

  public async runOnboardingStep(
    step: ProfileOnboardingStep | null = this.nextOnboardingStep()
  ): Promise<void> {
    this.error = '';
    const enablesPasskey =
      step?.id === 'security' &&
      !this.isPasskeyLinked() &&
      this.canEnablePasskey();
    if (enablesPasskey) {
      this.passkeyMessage = '';
      this.passkeyLoading = true;
    }
    try {
      const result = await this.profile.runOnboardingAction(
        step?.id ?? null,
        this.isPasskeyLinked()
      );
      if (result === 'passkey-enabled') {
        this.passkeyMessage = 'Passkey authentication enabled';
      } else if (result === 'passkey-unavailable') {
        this.error = 'Passkey linking is not enabled in this environment.';
      }
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Onboarding action failed';
    } finally {
      if (enablesPasskey) {
        this.passkeyLoading = false;
      }
    }
  }

  public usdBalanceLabel(): string {
    return '$0.00';
  }

  public usdChangeLabel(): string {
    return '+$0.00';
  }

  public usdChangePercentLabel(): string {
    return '0.00%';
  }

  public activityVolumeLabel(): string {
    return `$${formatUsdAmount(this.activity.volumeUsd)}`;
  }

  public activityFiatLabel(): string {
    return `≈ $${formatUsdAmount(this.activity.fiatUsd)}`;
  }

  public activityTodayLabel(): string {
    const sign = this.activity.todayDeltaUsd >= 0 ? '+' : '-';
    return `${sign}$${formatUsdAmount(Math.abs(this.activity.todayDeltaUsd))} (${this.activity.todayPercent.toFixed(2)}%)`;
  }

  public isActivityTodayUp(): boolean {
    return this.activity.todayDeltaUsd > 0;
  }

  public activitySwapCountLabel(): string {
    return `${this.activity.completedSwapCount} swaps`;
  }

  public heatmapDayTooltip(day: ActivityHeatmapDay): string {
    return formatActivityDayTooltip(day);
  }

  public selectHeatmapYear(year: number): void {
    this.activity = this.activitySource.snapshot(year);
    this.refreshOnboarding();
  }

  public trackByHeatmapYear(_index: number, year: number): number {
    return year;
  }

  public trackByHeatmapWeek(index: number, week: ActivityHeatmapWeek): string {
    return week.days[0]?.isoDate ?? String(index);
  }

  public trackByHeatmapDay(_index: number, day: ActivityHeatmapDay): string {
    return day.isoDate;
  }

  public async openActivityPay(): Promise<void> {
    await this.profile.navigateTo('/');
  }

  public async openActivityReceive(): Promise<void> {
    await this.openWalletModal();
  }

  public async openActivityAnalyze(): Promise<void> {
    await this.profile.navigateTo('/portfolio');
  }

  public walletPillLabel(): string {
    if (this.connectedAccount) {
      return this.shortAddress(this.connectedAccount);
    }

    const last = this.resolveLastConnectedWallet();
    if (last) {
      return this.isEmbeddedWallet(last)
        ? 'CraftScript wallet'
        : this.shortAddress(last.account);
    }

    const primary = this.primaryLinkedWallet();
    if (primary) {
      return this.isEmbeddedWallet(primary)
        ? 'CraftScript wallet'
        : this.shortAddress(primary.address);
    }

    return 'No wallet';
  }

  public isLiveConnected(): boolean {
    return Boolean(this.connectedAccount);
  }

  public showLastConnectedSection(): boolean {
    return (
      !this.isLiveConnected() && Boolean(this.resolveLastConnectedWallet())
    );
  }

  public showEmptyConnectSection(): boolean {
    return (
      !this.isLiveConnected() &&
      !this.showLastConnectedSection() &&
      !this.hasLinkedWallets()
    );
  }

  public resolveLastConnectedWallet(): LastConnectedWallet | null {
    if (this.lastConnectedWallet) {
      return this.lastConnectedWallet;
    }

    const linked = this.primaryLinkedWallet();
    if (!linked) {
      return null;
    }

    return this.toLastConnected(linked);
  }

  public isEmbeddedWallet(
    wallet: LastConnectedWallet | BackendWallet | null | undefined
  ): boolean {
    if (!wallet) {
      return false;
    }

    if ('walletType' in wallet) {
      return String(wallet.walletType).toLowerCase() === 'embedded';
    }

    return false;
  }

  public canRemoveLinkedWallet(wallet: BackendWallet): boolean {
    return !this.isEmbeddedWallet(wallet);
  }

  public async openWalletModal(): Promise<void> {
    await this.profile.openWalletModal();
  }

  public async generateWallet(): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    this.walletLoading = true;
    try {
      this.balances = await this.profile.generateWallet();
      this.walletMessage = 'Wallet generated';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet setup failed';
    } finally {
      this.walletLoading = false;
    }
  }

  public async disconnectWallet(): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    this.walletActionBusy = true;
    try {
      const current = this.connectedAccount;
      const linked = current ? this.findLinkedWallet(current) : undefined;
      this.profile.disconnectWallet(
        current,
        linked ? this.toLastConnected(linked) : this.lastConnectedWallet
      );
      this.walletMessage = 'Wallet disconnected';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet disconnect failed';
    } finally {
      this.walletActionBusy = false;
    }
  }

  public async reconnectWallet(): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    this.walletActionBusy = true;
    try {
      if (await this.profile.reconnectWallet(this.lastConnectedWallet)) {
        this.walletMessage = 'Wallet reconnected';
      }
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet reconnect failed';
    } finally {
      this.walletActionBusy = false;
    }
  }

  public connectAnotherWallet(): void {
    this.error = '';
    this.walletMessage = '';
    this.profile.requestWalletOpen();
  }

  public async refreshWallets(): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    try {
      await this.profile.reloadWallets();
      this.walletMessage = 'Wallets refreshed';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet refresh failed';
    }
  }

  public async refreshBalances(): Promise<void> {
    this.error = '';
    this.balanceMessage = '';
    this.balancesLoading = true;
    try {
      this.balances = await this.profile.loadBalances();
      this.balanceMessage =
        this.balances.length > 0 ? 'Balances refreshed' : '';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Balance refresh failed';
    } finally {
      this.balancesLoading = false;
    }
  }

  public async setPrimaryWallet(wallet: BackendWallet): Promise<void> {
    if (wallet.isPrimary) {
      return;
    }

    this.error = '';
    this.walletMessage = '';
    this.busyWalletId = wallet.id;
    try {
      await this.profile.setPrimaryWallet(wallet.id);
      this.walletMessage = `${this.shortAddress(wallet.address)} is now active`;
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet activation failed';
    } finally {
      this.busyWalletId = '';
    }
  }

  public async deleteWallet(wallet: BackendWallet): Promise<void> {
    if (!this.canRemoveLinkedWallet(wallet)) {
      this.error =
        'Embedded wallets stay linked to your account and cannot be removed.';
      return;
    }

    this.error = '';
    this.walletMessage = '';
    this.busyWalletId = wallet.id;
    try {
      await this.profile.deleteWallet(wallet.id);
      this.walletMessage = `${this.shortAddress(wallet.address)} removed`;
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet removal failed';
    } finally {
      this.busyWalletId = '';
    }
  }

  public async requestDeletion(): Promise<void> {
    this.error = '';
    this.deletionMessage = '';
    try {
      const deletionAvailableAt = await this.profile.requestDeletion();
      this.deletionMessage = `Deletion available ${new Date(deletionAvailableAt).toLocaleDateString()}`;
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Account deletion failed';
    }
  }

  public async logout(): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    this.balanceMessage = '';
    this.deletionMessage = '';
    this.passkeyMessage = '';
    try {
      await this.profile.logout();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Logout failed';
    }
  }

  private buildOnboardingViewModel(): ProfileOnboardingViewModel {
    return this.profile.buildOnboardingViewModel({
      walletDone: this.hasLinkedWallets() || this.isLiveConnected(),
      passkeyDone: this.isPasskeyLinked(),
      completedSwapCount: this.completedSwapCount(),
      requiredSwapCount: this.requiredSwapCount,
      walletLabel: this.walletPillLabel(),
    });
  }

  private refreshOnboarding(): void {
    this.onboarding = this.buildOnboardingViewModel();
  }

  private seedLastConnectedFromBackend(wallets: BackendWallet[]): void {
    if (this.lastConnectedWallet || wallets.length === 0) {
      return;
    }

    const linked = this.primaryLinkedWallet(wallets);
    if (linked) {
      this.profile.rememberConnectedWallet(this.toLastConnected(linked));
    }
  }

  private primaryLinkedWallet(
    wallets: BackendWallet[] = this.session?.wallets ?? []
  ): BackendWallet | undefined {
    return wallets.find(wallet => wallet.isPrimary) ?? wallets[0];
  }

  private findLinkedWallet(address: string): BackendWallet | undefined {
    const normalized = address.toLowerCase();
    return this.session?.wallets.find(
      wallet => wallet.address.toLowerCase() === normalized
    );
  }

  private toLastConnected(wallet: BackendWallet): LastConnectedWallet {
    return {
      account: wallet.address,
      chainId: null,
      walletType:
        String(wallet.walletType).toLowerCase() === 'embedded'
          ? 'embedded'
          : 'external',
      source: wallet.source,
    };
  }

  private rawToDecimal(rawBalance: string, decimals: number): string {
    if (!/^\d+$/.test(rawBalance) || decimals <= 0) {
      return rawBalance;
    }

    const padded = rawBalance.padStart(decimals + 1, '0');
    const whole = padded.slice(0, -decimals);
    const fraction = padded.slice(-decimals).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
  }

  private capitalizeLabel(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private lastConnectedChainType(
    wallet: LastConnectedWallet
  ): string | undefined {
    return (
      this.findLinkedWallet(wallet.account)?.chainType ||
      this.chainTypeFromId(wallet.chainId)
    );
  }

  private chainTypeFromId(chainId: number | null): string {
    if (chainId === 1) {
      return 'ethereum';
    }

    return '';
  }
}
