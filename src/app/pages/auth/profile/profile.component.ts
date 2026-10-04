import type { WalletBalance } from '@shared/services/wallet-balances.service';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CountUp } from 'countup.js';
import { Subscription } from 'rxjs';
import type { AuthSession, BackendWallet } from '@core/auth/auth-session.types';
import { LastConnectedWallet } from '@domains/wallet/models/wallet.models';
import type { PortfolioSnapshot } from '../../portfolio/portfolio.models';
import {
  formatActivityDayTooltip,
  type ActivityHeatmapDay,
  type ActivityHeatmapWeek,
} from '@shared/utils/activity-heatmap.utils';
import { EXCHANGE_TOKEN_ICON_URLS } from '@shared/utils/token-avatar.utils';
import { atomicToDecimal } from '@shared/utils/amount-format.utils';
import { isNearWalletAddress } from '@shared/utils/network.utils';
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

const REQUIRED_SWAP_COUNT = 5;
const ZERO_USD_LABEL = '$0.00';

function formatUsdAmount(value: number): string {
  return value.toFixed(2);
}

function formatUsdCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return ZERO_USD_LABEL;
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

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
export class ProfileComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('usdBalanceValue')
  private usdBalanceValue?: ElementRef<HTMLElement>;

  public session: AuthSession | null = null;
  public walletMessage = '';
  public passkeyMessage = '';
  public error = '';
  public busyWalletId = '';
  public passkeyLoading = false;
  public balances: WalletBalance[] = [];
  public balancesLoading = false;
  public balanceStateMessage = 'Connect the active wallet to load balances.';
  public portfolio: PortfolioSnapshot | null = null;
  public portfolioStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  public activeWalletId?: string;
  public connectedAccount: string | null = null;
  public connectedChainId: number | null = null;
  public lastConnectedWallet: LastConnectedWallet | null = null;
  public walletActionBusy = false;
  public walletLoading = false;

  public readonly requiredSwapCount = REQUIRED_SWAP_COUNT;
  public activity: ProfileActivitySnapshot;
  public onboarding: ProfileOnboardingViewModel;

  private subscription?: Subscription;
  private portfolioRequestId = 0;
  private portfolioCacheKeyLoaded: string | null = null;
  private portfolioInFlightKey: string | null = null;
  private displayedBalanceValue = 0;
  private pendingBalanceAnimation: number | null = null;
  private balanceCountUp: CountUp | null = null;

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
      this.profile.activeWallet$.subscribe(state => {
        this.activeWalletId = state.wallet?.id;
        const session = state.session ?? null;
        const account = state.connected ? state.snapshot : undefined;
        const previousAccount = this.connectedAccount;
        const previousChainId = this.connectedChainId;
        this.connectedAccount = account?.account ?? null;
        this.connectedChainId = account?.chainId ?? null;
        this.session = session;
        if (session) {
          const accountChanged =
            this.connectedAccount !== previousAccount ||
            this.connectedChainId !== previousChainId;
          // Automatic session ticks reuse cache / in-flight; force only via
          // refreshBalances(), swaps, or a real account change.
          void this.ensurePortfolioLoaded(accountChanged);
        } else {
          this.balances = [];
          this.resetPortfolioDisplay();
        }
        this.refreshOnboarding();
      })
    );
    this.subscription.add(
      this.profile.lastConnected$.subscribe(wallet => {
        this.lastConnectedWallet = wallet ?? null;
        this.refreshOnboarding();
      })
    );
    this.subscription.add(
      this.profile.balances$.subscribe(state => {
        this.balances = state.rows;
        this.balancesLoading = state.status === 'loading';
        this.balanceStateMessage =
          state.errorMessage ??
          (state.status === 'idle'
            ? 'Reconnect the active wallet to load balances.'
            : state.rows.length === 0
              ? 'No balances found for this wallet.'
              : '');
      })
    );
    this.subscription.add(
      this.profile.swapSettled$.subscribe(() => {
        void this.ensurePortfolioLoaded(true);
      })
    );
  }

  public ngAfterViewInit(): void {
    if (this.pendingBalanceAnimation != null) {
      this.animateBalanceTo(this.pendingBalanceAnimation);
      this.pendingBalanceAnimation = null;
    }
  }

  public ngOnDestroy(): void {
    this.portfolioRequestId += 1;
    this.cancelBalanceAnimation();
    this.subscription?.unsubscribe();
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

  public balanceAmount(balance: WalletBalance): string {
    const amount =
      balance.balanceDecimal ||
      this.rawToDecimal(balance.balanceRaw, balance.decimals);
    return `${amount} ${balance.symbol}`;
  }

  public balanceMeta(balance: WalletBalance): string {
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
    if (this.portfolioStatus === 'error') {
      return 'Unavailable';
    }
    if (this.portfolioStatus === 'ready') {
      const total = Number(this.portfolio?.totalValue ?? 0);
      return formatUsdCurrency(total);
    }
    return ZERO_USD_LABEL;
  }

  public tokenBalanceLabel(): string {
    if (this.portfolioStatus !== 'ready' || !this.portfolio?.positions.length) {
      return '';
    }
    const visible = this.portfolio.positions.slice(0, 2).map(position => {
      const quantity = Number(position.quantity);
      const amount = Number.isFinite(quantity)
        ? quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })
        : position.quantity;
      return `${amount} ${position.symbol}`;
    });
    const remaining = this.portfolio.positions.length - visible.length;
    return remaining > 0
      ? `${visible.join(' · ')} · +${remaining} more`
      : visible.join(' · ');
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
    return this.lastConnectedWallet;
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
      await this.profile.generateWallet();
      this.walletMessage = 'Wallet generated';
      await this.ensurePortfolioLoaded(true);
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
    this.profile.refreshBalances();
    await this.ensurePortfolioLoaded(true);
  }

  public async ensurePortfolioLoaded(force = false): Promise<void> {
    if (!this.session) {
      this.resetPortfolioDisplay();
      return;
    }
    const cacheKey = this.portfolioCacheKey();
    if (
      !force &&
      (this.portfolioCacheKeyLoaded === cacheKey ||
        this.portfolioInFlightKey === cacheKey)
    ) {
      return;
    }
    await this.refreshPortfolio();
  }

  public async refreshPortfolio(): Promise<void> {
    const requestId = ++this.portfolioRequestId;
    if (!this.session) {
      this.resetPortfolioDisplay();
      return;
    }
    const cacheKey = this.portfolioCacheKey();
    this.portfolioInFlightKey = cacheKey;
    this.portfolioStatus = 'loading';
    try {
      const portfolio = await this.profile.loadPortfolio(
        this.connectedAccount,
        this.connectedChainId
      );
      if (requestId !== this.portfolioRequestId) {
        return;
      }
      this.portfolio = portfolio;
      this.portfolioStatus = 'ready';
      this.portfolioCacheKeyLoaded = cacheKey;
      this.portfolioInFlightKey = null;
      const total = Number(portfolio.totalValue ?? 0);
      this.settleBalanceDisplay(Number.isFinite(total) ? total : 0);
    } catch {
      if (requestId !== this.portfolioRequestId) {
        return;
      }
      this.portfolio = null;
      this.portfolioStatus = 'error';
      this.portfolioCacheKeyLoaded = null;
      this.portfolioInFlightKey = null;
      this.displayedBalanceValue = 0;
      this.cancelBalanceAnimation();
      const el = this.usdBalanceValue?.nativeElement;
      if (el) {
        el.textContent = 'Unavailable';
      }
    }
  }

  public async setPrimaryWallet(wallet: BackendWallet): Promise<void> {
    if (wallet.isPrimary || this.busyWalletId) {
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
    if (this.busyWalletId) return;
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

  private portfolioCacheKey(): string {
    return [
      this.session?.user.id ?? '',
      this.session?.user.sessionId ?? '',
      this.activeWalletId ?? '',
      this.connectedAccount ?? '',
      this.connectedChainId ?? '',
    ].join(':');
  }

  private resetPortfolioDisplay(): void {
    this.portfolio = null;
    this.portfolioStatus = 'idle';
    this.portfolioCacheKeyLoaded = null;
    this.portfolioInFlightKey = null;
    this.portfolioRequestId += 1;
    this.cancelBalanceAnimation();
    this.setBalanceLabelImmediate(0);
  }

  private settleBalanceDisplay(value: number): void {
    if (!this.usdBalanceValue?.nativeElement) {
      this.cancelBalanceAnimation();
      this.pendingBalanceAnimation = value;
      this.setBalanceLabelImmediate(value);
      return;
    }
    this.animateBalanceTo(value);
  }

  private stopActiveCountUp(): void {
    const active = this.balanceCountUp;
    if (!active) {
      return;
    }
    active.onDestroy();
    this.balanceCountUp = null;
  }

  private cancelBalanceAnimation(): void {
    this.pendingBalanceAnimation = null;
    this.stopActiveCountUp();
  }

  private setBalanceLabelImmediate(value: number): void {
    this.stopActiveCountUp();
    this.displayedBalanceValue = value;
    const el = this.usdBalanceValue?.nativeElement;
    if (el) {
      el.textContent = formatUsdCurrency(value);
    }
  }

  private animateBalanceTo(value: number): void {
    const el = this.usdBalanceValue?.nativeElement;
    if (!el) {
      this.cancelBalanceAnimation();
      this.pendingBalanceAnimation = value;
      this.setBalanceLabelImmediate(value);
      return;
    }

    this.cancelBalanceAnimation();
    const startVal = this.displayedBalanceValue;
    this.displayedBalanceValue = value;
    if (startVal === value) {
      el.textContent = formatUsdCurrency(value);
      return;
    }

    this.balanceCountUp = new CountUp(el, value, {
      startVal,
      duration: 1.1,
      decimalPlaces: 2,
      useEasing: true,
      useGrouping: true,
      formattingFn: (n: number) => formatUsdCurrency(n),
    });
    if (this.balanceCountUp.error) {
      el.textContent = formatUsdCurrency(value);
      this.balanceCountUp = null;
      return;
    }
    this.balanceCountUp.start();
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
    try {
      return atomicToDecimal(rawBalance, decimals);
    } catch {
      return rawBalance;
    }
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
      this.chainTypeFromId(wallet.chainId) ||
      (isNearWalletAddress(wallet.account) ? 'near' : undefined)
    );
  }

  private chainTypeFromId(chainId: number | null): string {
    if (chainId === 1) {
      return 'ethereum';
    }

    return '';
  }
}
