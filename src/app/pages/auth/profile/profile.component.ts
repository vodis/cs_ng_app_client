import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type {
  AuthSession,
  BackendBalance,
  BackendWallet,
} from '@core/auth/auth-session.types';
import { LastConnectedWallet } from '@domains/wallet/models/wallet.models';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { EXCHANGE_TOKEN_ICON_URLS } from '@shared/utils/token-avatar.utils';

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
  public showAllSessions = false;
  public readonly loginSessions = MOCK_LOGIN_SESSIONS;
  public visibleLoginSessions = MOCK_LOGIN_SESSIONS.slice(0, 2);

  private subscription?: Subscription;

  constructor(
    public readonly authSession: AuthSessionService,
    private readonly walletsService: WalletsService,
    private readonly walletGatewayBridge: WalletGatewayBridgeService
  ) {}

  public ngOnInit(): void {
    this.subscription = new Subscription();
    this.subscription.add(
      this.authSession.session$.subscribe(session => {
        this.session = session;
        if (session) {
          this.seedLastConnectedFromBackend(session.wallets);
          void this.refreshBalances();
        } else {
          this.balances = [];
        }
      })
    );
    this.subscription.add(
      this.walletsService.account.subscribe(account => {
        this.connectedAccount = account?.account ?? null;
      })
    );
    this.subscription.add(
      this.walletsService.lastConnected.subscribe(wallet => {
        this.lastConnectedWallet = wallet ?? null;
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
    return `${this.shortAddress(balance.walletAddress)} / ${balance.chainType} / ${expiresAt}`;
  }

  public canEnablePasskey(): boolean {
    return this.authSession.passkeyLinkEnabled;
  }

  public isPasskeyLinked(): boolean {
    return this.session?.user.passkeyEnabled === true;
  }

  public isPasskeyLoginAvailable(): boolean {
    return this.authSession.passkeyLoginEnabled;
  }

  public async enablePasskey(): Promise<void> {
    this.error = '';
    this.passkeyMessage = '';
    this.passkeyLoading = true;
    try {
      await this.authSession.enablePasskey();
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
    try {
      await this.walletGatewayBridge.syncConnectedWallet();
    } catch {}
    this.walletsService.requestOpen();
  }

  public async disconnectWallet(): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    this.walletActionBusy = true;
    try {
      const current = this.connectedAccount;
      if (current) {
        const linked = this.findLinkedWallet(current);
        this.walletsService.rememberConnectedWallet(
          linked
            ? this.toLastConnected(linked)
            : {
                account: current,
                chainId: this.walletsService.account.value?.chainId ?? null,
                walletType: this.lastConnectedWallet?.walletType ?? 'external',
                source: this.lastConnectedWallet?.source,
                connectorId: this.lastConnectedWallet?.connectorId,
              }
        );
      }
      this.walletGatewayBridge.disconnectWallet();
      this.walletsService.setAccount(undefined);
      this.walletsService.requestClose();
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
      const snapshot = await this.walletGatewayBridge.syncConnectedWallet();
      if (snapshot.account) {
        this.walletsService.setAccount({
          account: snapshot.account,
          chainId: snapshot.chainId,
        });
        this.walletsService.rememberConnectedWallet({
          account: snapshot.account,
          chainId: snapshot.chainId,
          walletType:
            snapshot.identity?.walletType ??
            this.lastConnectedWallet?.walletType ??
            'external',
          source:
            snapshot.identity?.connectorId ?? this.lastConnectedWallet?.source,
          connectorId:
            snapshot.identity?.connectorId ??
            this.lastConnectedWallet?.connectorId,
        });
        this.walletMessage = 'Wallet reconnected';
        return;
      }

      this.walletsService.requestOpen();
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet reconnect failed';
      this.walletsService.requestOpen();
    } finally {
      this.walletActionBusy = false;
    }
  }

  public connectAnotherWallet(): void {
    this.error = '';
    this.walletMessage = '';
    this.walletsService.requestOpen();
  }

  public async refreshWallets(): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    try {
      await this.authSession.reloadWallets();
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
      this.balances = await this.authSession.loadBalances();
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
      await this.authSession.setPrimaryWallet(wallet.id);
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
      await this.authSession.deleteWallet(wallet.id);
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
      const deletionAvailableAt = await this.authSession.requestDeletion();
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
      await this.authSession.logout();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Logout failed';
    }
  }

  private seedLastConnectedFromBackend(wallets: BackendWallet[]): void {
    if (this.lastConnectedWallet || wallets.length === 0) {
      return;
    }

    const linked = this.primaryLinkedWallet(wallets);
    if (linked) {
      this.walletsService.rememberConnectedWallet(this.toLastConnected(linked));
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
