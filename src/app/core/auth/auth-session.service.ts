import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthProviderService } from './auth-provider.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { ProductEventsService } from '@core/product-events/product-events.service';
import {
  AuthSession,
  BackendBalance,
  BackendUser,
  BackendWallet,
  LoginMethod,
} from './auth-session.types';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';

type MeResponse = {
  user: BackendUser;
};

type WalletsResponse = {
  wallets: BackendWallet[];
};

type WalletResponse = {
  wallet: BackendWallet;
};

type BalancesResponse = {
  data: BackendBalance[];
};

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(
    null
  );
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private sessionRevision = 0;
  private refreshVersion = 0;
  private walletRequestVersion = 0;
  private primaryRequestVersion = 0;
  private primaryPending = false;

  private readonly restoredSubject = new BehaviorSubject(false);
  readonly restored$ = this.restoredSubject.asObservable();

  get sessionRestored(): boolean {
    return this.restoredSubject.value;
  }

  readonly session$ = this.sessionSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly providerSnapshot$ = this.authProvider.snapshot$;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly router: Router,
    private readonly authProvider: AuthProviderService,
    private readonly walletGatewayBridge: WalletGatewayBridgeService,
    private readonly walletsService: WalletsService,
    private readonly productEvents: ProductEventsService,
    private readonly localizedRouting: LocalizedRoutingService
  ) {
    // Public routes never hit AuthGuard, so restore host session once the
    // provider is ready whenever a valid access token already exists.
    this.restoreSessionWhenProviderReady();
  }

  get session(): AuthSession | null {
    return this.sessionSubject.value;
  }

  get enabledLoginMethods(): LoginMethod[] {
    const methods = this.authProvider.snapshot.loginMethods;
    return methods.length > 0 ? methods : ['email'];
  }

  get passkeyLoginEnabled(): boolean {
    const snapshot = this.authProvider.snapshot;
    return (
      snapshot.passkeyLoginEnabled && snapshot.loginMethods.includes('passkey')
    );
  }

  get passkeyLinkEnabled(): boolean {
    return this.authProvider.snapshot.passkeyLinkEnabled;
  }

  async refresh(options?: {
    clearOnFailure?: boolean;
  }): Promise<AuthSession | null> {
    const refreshVersion = ++this.refreshVersion;
    const revision = this.sessionRevision;
    const walletVersion = this.walletRequestVersion;
    const clearOnFailure = options?.clearOnFailure !== false;
    const token = await this.currentAccessToken();
    if (!token) {
      if (
        clearOnFailure &&
        refreshVersion === this.refreshVersion &&
        revision === this.sessionRevision &&
        walletVersion === this.walletRequestVersion &&
        !this.primaryPending
      ) {
        this.sessionSubject.next(null);
      }
      return null;
    }

    try {
      const headers = this.authHeaders(token);
      const [me, wallets] = await Promise.all([
        firstValueFrom(
          this.httpClient.get<MeResponse>(`${environment.apiUrl}/api/v1/me`, {
            headers,
          })
        ),
        firstValueFrom(
          this.httpClient.get<WalletsResponse>(
            `${environment.apiUrl}/api/v1/wallets`,
            { headers }
          )
        ),
      ]);
      if (
        refreshVersion !== this.refreshVersion ||
        revision !== this.sessionRevision ||
        walletVersion !== this.walletRequestVersion ||
        this.primaryPending
      )
        return this.session;
      const session = { user: me.user, wallets: wallets.wallets };
      this.sessionSubject.next(session);
      return session;
    } catch {
      if (
        clearOnFailure &&
        refreshVersion === this.refreshVersion &&
        revision === this.sessionRevision &&
        walletVersion === this.walletRequestVersion &&
        !this.primaryPending
      ) {
        this.sessionSubject.next(null);
      }
      return null;
    }
  }

  async login(authMethod: LoginMethod): Promise<AuthSession> {
    this.loadingSubject.next(true);
    this.productEvents.record({
      eventName: 'auth.login',
      status: 'attempted',
      metadata: { authMethod },
    });
    try {
      const session = await this.authProvider.login(authMethod);
      const token = await this.authProvider.getAccessToken();
      if (!token) {
        throw new Error('Account provider access token is unavailable');
      }
      this.sessionRevision++;
      this.sessionSubject.next(session);
      this.productEvents.record({
        eventName: 'auth.login',
        status: 'succeeded',
        userId: session.user.id,
        metadata: { authMethod },
      });
      return session;
    } catch (error) {
      this.productEvents.recordFailure('auth.login', error, {
        metadata: { authMethod },
      });
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async sendEmailCode(email: string): Promise<void> {
    this.loadingSubject.next(true);
    try {
      await this.authProvider.sendEmailCode(email);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async verifyEmailCode(email: string, code: string): Promise<AuthSession> {
    this.loadingSubject.next(true);
    try {
      const session = await this.authProvider.verifyEmailCode({ email, code });
      const token = await this.authProvider.getAccessToken();
      if (!token) {
        throw new Error('Account provider access token is unavailable');
      }
      this.sessionRevision++;
      this.sessionSubject.next(session);
      return session;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async enablePasskey(): Promise<AuthSession> {
    this.loadingSubject.next(true);
    try {
      const session = await this.authProvider.linkPasskey();
      const token = await this.authProvider.getAccessToken();
      if (!token) {
        throw new Error('Account provider access token is unavailable');
      }
      this.sessionRevision++;
      this.sessionSubject.next(session);
      return session;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async ensureEmbeddedWallet(): Promise<void> {
    this.loadingSubject.next(true);
    try {
      await this.authProvider.ensureEmbeddedWallet();
      await this.walletGatewayBridge
        .syncConnectedWallet()
        .catch(() => undefined);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async logout(): Promise<void> {
    this.loadingSubject.next(true);
    try {
      await this.clearAuthenticatedState();
      await this.router.navigateByUrl(this.localizedRouting.path('/'));
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async requestDeletion(): Promise<string> {
    const token = await this.currentAccessToken();
    if (!token) {
      throw new Error('No active session');
    }

    const response = await firstValueFrom(
      this.httpClient.delete<{ status: string; deletionAvailableAt: string }>(
        `${environment.apiUrl}/api/v1/me`,
        { headers: this.authHeaders(token) }
      )
    );
    await this.clearAuthenticatedState();
    await this.router.navigateByUrl(this.localizedRouting.path('/'));
    return response.deletionAvailableAt;
  }

  async reloadWallets(): Promise<BackendWallet[]> {
    const revision = this.sessionRevision;
    const requestVersion = ++this.walletRequestVersion;
    const token = await this.currentAccessToken();
    if (!token) {
      throw new Error('No active session');
    }

    const response = await firstValueFrom(
      this.httpClient.get<WalletsResponse>(
        `${environment.apiUrl}/api/v1/wallets`,
        {
          headers: this.authHeaders(token),
        }
      )
    );
    if (
      revision === this.sessionRevision &&
      requestVersion === this.walletRequestVersion &&
      !this.primaryPending
    ) {
      this.updateWallets(response.wallets);
    }
    return response.wallets;
  }

  async setPrimaryWallet(walletId: string): Promise<BackendWallet> {
    const revision = this.sessionRevision;
    const requestVersion = ++this.primaryRequestVersion;
    ++this.walletRequestVersion;
    this.primaryPending = true;
    try {
      const token = await this.currentAccessToken();
      if (!token) throw new Error('No active session');
      const response = await firstValueFrom(
        this.httpClient.patch<WalletResponse>(
          `${environment.apiUrl}/api/v1/wallets/${walletId}/primary`,
          {},
          { headers: this.authHeaders(token) }
        )
      );
      if (
        revision === this.sessionRevision &&
        requestVersion === this.primaryRequestVersion
      ) {
        this.primaryPending = false;
        ++this.walletRequestVersion;
        this.updateWallets(
          (this.session?.wallets ?? []).map(wallet => ({
            ...wallet,
            isPrimary: wallet.id === response.wallet.id,
          }))
        );
        await this.reloadWallets();
      }
      return response.wallet;
    } finally {
      if (requestVersion === this.primaryRequestVersion)
        this.primaryPending = false;
    }
  }

  async deleteWallet(walletId: string): Promise<void> {
    const token = await this.currentAccessToken();
    if (!token) {
      throw new Error('No active session');
    }

    await firstValueFrom(
      this.httpClient.delete(
        `${environment.apiUrl}/api/v1/wallets/${walletId}`,
        {
          headers: this.authHeaders(token),
        }
      )
    );
    await this.reloadWallets();
  }

  async loadBalances(walletId?: string): Promise<BackendBalance[]> {
    const token = await this.currentAccessToken();
    if (!token) {
      throw new Error('No active session');
    }

    const response = await firstValueFrom(
      this.httpClient.get<BalancesResponse>(
        `${environment.apiUrl}/api/v1/balances`,
        {
          headers: this.authHeaders(token),
          params: walletId ? { walletId } : {},
        }
      )
    );
    return response.data ?? [];
  }

  clear(): void {
    this.sessionRevision++;
    this.walletRequestVersion++;
    this.primaryRequestVersion++;
    this.primaryPending = false;
    this.sessionSubject.next(null);
  }

  private restoreSessionWhenProviderReady(): void {
    void this.authProvider
      .whenSettled()
      .then(async snapshot => {
        if (snapshot.status !== 'ready' || this.sessionSubject.value) {
          return;
        }
        await this.refresh({ clearOnFailure: false });
      })
      .catch(() => undefined)
      .finally(() => this.restoredSubject.next(true));
  }

  private async clearAuthenticatedState(): Promise<void> {
    await this.authProvider.logout().catch(() => undefined);
    this.walletGatewayBridge.disconnectWallet();
    this.walletsService.setAccount(undefined);
    this.clear();
  }

  private updateWallets(wallets: BackendWallet[]): void {
    const session = this.sessionSubject.value;
    if (!session) {
      return;
    }
    this.sessionSubject.next({ ...session, wallets });
  }

  private async currentAccessToken(): Promise<string | null> {
    const revision = this.sessionRevision;
    const token = await this.authProvider.getAccessToken().catch(() => null);
    if (revision !== this.sessionRevision) return null;
    if (!token) this.clear();
    return token ?? null;
  }

  private authHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
