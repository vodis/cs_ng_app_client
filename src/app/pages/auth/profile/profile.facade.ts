import { map, Subscription } from 'rxjs';
import { ActiveWalletFacade } from '@domains/wallet/application/active-wallet.facade';
import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession, BackendWallet } from '@core/auth/auth-session.types';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import type { LastConnectedWallet } from '@domains/wallet/models/wallet.models';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { PortfolioApiService } from '../../portfolio/portfolio-api.service';
import type { PortfolioSnapshot } from '../../portfolio/portfolio.models';

export type ProfileOnboardingAction =
  | 'complete'
  | 'passkey-enabled'
  | 'passkey-unavailable'
  | 'wallet-opened';

export type ProfileOnboardingStepId = 'wallet' | 'security' | 'swaps';

export type ProfileOnboardingStep = {
  id: ProfileOnboardingStepId;
  title: string;
  hint: string;
  done: boolean;
};

export type ProfileOnboardingViewModel = {
  steps: ProfileOnboardingStep[];
  nextStep: ProfileOnboardingStep | null;
  remainingCount: number;
  remainingLabel: string;
  progressPercent: number;
  nextCta: string;
  nextTitle: string;
};

export type ProfileOnboardingState = {
  walletDone: boolean;
  passkeyDone: boolean;
  completedSwapCount: number;
  requiredSwapCount: number;
  walletLabel: string;
};

@Injectable({ providedIn: 'root' })
export class ProfileFacade implements OnDestroy {
  private portfolioCache?: {
    key: string;
    loadedAt: number;
    result: Promise<PortfolioSnapshot>;
  };
  private readonly subscriptions = new Subscription();
  private contextKey = '';

  public readonly loading$ = this.authSession.loading$;
  public readonly providerSnapshot$ = this.authSession.providerSnapshot$;
  public readonly activeWallet$ = this.activeWallet.state$;
  public readonly balances$ = this.activeWallet.balances$;
  public readonly lastConnected$ = this.activeWallet.state$.pipe(
    map(state => {
      const wallet = state.wallet;
      if (!wallet) return undefined;
      const remembered: LastConnectedWallet = {
        account: wallet.address,
        chainId: state.connected ? (state.snapshot?.chainId ?? null) : null,
        walletType: wallet.walletType === 'embedded' ? 'embedded' : 'external',
        source: wallet.source,
      };
      return remembered;
    })
  );
  public readonly swapSettled$ = this.walletsService.swapSettled.asObservable();

  constructor(
    private readonly authSession: AuthSessionService,
    private readonly walletsService: WalletsService,
    private readonly walletGatewayBridge: WalletGatewayBridgeService,
    private readonly router: Router,
    private readonly localizedRouting: LocalizedRoutingService,
    private readonly portfolioApi: PortfolioApiService,
    private readonly activeWallet: ActiveWalletFacade
  ) {
    this.subscriptions.add(
      this.activeWallet.state$.subscribe(state => {
        const key = JSON.stringify([
          state.userId ?? state.session?.user.id,
          state.sessionId ?? state.session?.user.sessionId,
          state.wallet?.id,
          state.network,
        ]);
        if (key !== this.contextKey) this.portfolioCache = undefined;
        this.contextKey = key;
      })
    );
    this.subscriptions.add(
      this.walletsService.swapSettled.subscribe(() => {
        this.portfolioCache = undefined;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  revalidateBalances(): void {
    this.activeWallet.revalidateBalances();
  }

  public get passkeyLinkEnabled(): boolean {
    return this.authSession.passkeyLinkEnabled;
  }

  public get passkeyLoginEnabled(): boolean {
    return this.authSession.passkeyLoginEnabled;
  }

  public async enablePasskey(): Promise<AuthSession> {
    return this.authSession.enablePasskey();
  }

  public async runOnboardingAction(
    stepId: ProfileOnboardingStepId | null,
    passkeyLinked: boolean
  ): Promise<ProfileOnboardingAction> {
    if (stepId === 'wallet') {
      await this.openWalletModal();
      return 'wallet-opened';
    }

    if (stepId === 'security') {
      if (passkeyLinked) {
        return 'complete';
      }
      if (!this.passkeyLinkEnabled) {
        return 'passkey-unavailable';
      }
      await this.enablePasskey();
      return 'passkey-enabled';
    }

    await this.navigateTo('/');
    return 'complete';
  }

  public buildOnboardingViewModel(
    state: ProfileOnboardingState
  ): ProfileOnboardingViewModel {
    const swapsDone = state.completedSwapCount >= state.requiredSwapCount;
    const steps: ProfileOnboardingStep[] = [
      {
        id: 'wallet',
        title: 'Connect or generate wallet',
        hint: state.walletDone
          ? state.walletLabel
          : 'Link a wallet to start trading',
        done: state.walletDone,
      },
      {
        id: 'security',
        title: 'Enable passkey or 2FA',
        hint: state.passkeyDone
          ? 'Passkey enabled'
          : 'Faster, safer sign in next time',
        done: state.passkeyDone,
      },
      {
        id: 'swaps',
        title: `Complete ${state.requiredSwapCount} swaps`,
        hint: `${state.completedSwapCount} of ${state.requiredSwapCount} completed`,
        done: swapsDone,
      },
    ];
    const nextStep = steps.find(step => !step.done) ?? null;
    const remainingCount = steps.filter(step => !step.done).length;

    return {
      steps,
      nextStep,
      remainingCount,
      remainingLabel:
        remainingCount === 0
          ? 'All steps complete'
          : remainingCount === 1
            ? '1 step remaining'
            : `${remainingCount} steps remaining`,
      progressPercent: Math.round(
        (steps.filter(step => step.done).length / steps.length) * 100
      ),
      nextCta:
        nextStep?.id === 'wallet'
          ? 'Set up wallet'
          : nextStep?.id === 'security'
            ? 'Enable passkey'
            : nextStep?.id === 'swaps'
              ? 'Start swapping'
              : 'Go to Exchange',
      nextTitle: nextStep?.title ?? "You're all set",
    };
  }

  public async openWalletModal(): Promise<void> {
    await this.walletGatewayBridge.syncConnectedWallet().catch(() => undefined);
    this.walletsService.requestOpen('connect');
  }

  public async generateWallet(): Promise<void> {
    await this.authSession.ensureEmbeddedWallet();
    const wallets = await this.authSession.reloadWallets();
    if (wallets.length === 0) {
      throw new Error(
        'Wallet was created but profile refresh returned no wallets.'
      );
    }
  }

  public disconnectWallet(
    account: string | null,
    connectedWallet: LastConnectedWallet | null
  ): void {
    if (account) {
      const matchesCurrentAccount =
        connectedWallet?.account.toLowerCase() === account.toLowerCase();
      this.walletsService.rememberConnectedWallet(
        matchesCurrentAccount && connectedWallet
          ? connectedWallet
          : {
              account,
              chainId: this.walletsService.account.value?.chainId ?? null,
              walletType: connectedWallet?.walletType ?? 'external',
              source: connectedWallet?.source,
              connectorId: connectedWallet?.connectorId,
            }
      );
    }
    this.walletGatewayBridge.disconnectWallet();
    this.walletsService.setAccount(undefined);
    this.walletsService.requestClose();
  }

  public async reconnectWallet(
    previousWallet: LastConnectedWallet | null
  ): Promise<boolean> {
    try {
      const snapshot = await this.walletGatewayBridge.syncConnectedWallet();
      if (!snapshot.account || !this.activeWallet.state.connected) {
        this.activeWallet.requestConnection();
        return false;
      }

      this.walletsService.setAccount({
        account: snapshot.account,
        chainId: snapshot.chainId,
      });
      this.walletsService.rememberConnectedWallet({
        account: snapshot.account,
        chainId: snapshot.chainId,
        walletType:
          snapshot.identity?.walletType ??
          previousWallet?.walletType ??
          'external',
        source: snapshot.identity?.connectorId ?? previousWallet?.source,
        connectorId:
          snapshot.identity?.connectorId ?? previousWallet?.connectorId,
      });
      return true;
    } catch (error) {
      this.walletsService.requestOpen('connect');
      throw error;
    }
  }

  public requestWalletOpen(): void {
    this.walletsService.requestOpen('connect');
  }

  public reloadWallets(): Promise<BackendWallet[]> {
    return this.authSession.reloadWallets();
  }

  public refreshBalances(): void {
    this.portfolioCache = undefined;
    this.activeWallet.refreshBalances();
  }

  public loadPortfolio(
    account?: string | null,
    network?: string
  ): Promise<PortfolioSnapshot> {
    if (!account || !network)
      return Promise.reject(
        new Error('Select a wallet network to load its portfolio.')
      );
    const query = { walletAddress: account, network };
    const key = `${this.contextKey}|${JSON.stringify(query)}`;
    if (
      this.portfolioCache?.key === key &&
      Date.now() - this.portfolioCache.loadedAt < 15_000
    )
      return this.portfolioCache.result;
    const entry = {
      key,
      loadedAt: Infinity,
      result: this.portfolioApi.loadPortfolio(query),
    };
    this.portfolioCache = entry;
    void entry.result.then(
      () => {
        entry.loadedAt = Date.now();
      },
      () => {
        if (this.portfolioCache === entry) this.portfolioCache = undefined;
      }
    );
    return entry.result;
  }

  public setPrimaryWallet(walletId: string): Promise<BackendWallet> {
    return this.authSession.setPrimaryWallet(walletId);
  }

  public deleteWallet(walletId: string): Promise<void> {
    return this.authSession.deleteWallet(walletId);
  }

  public requestDeletion(): Promise<string> {
    return this.authSession.requestDeletion();
  }

  public logout(): Promise<void> {
    return this.authSession.logout();
  }

  public navigateTo(path: '/' | '/portfolio'): Promise<boolean> {
    return this.router.navigateByUrl(this.localizedRouting.path(path));
  }
}
