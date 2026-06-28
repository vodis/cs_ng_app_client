import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import type { PublicAuthConfig } from '@core/privy/privy-bridge.types';
import {
  AuthSession,
  BackendBalance,
  BackendUser,
  BackendWallet,
  emailFromPrivyUser,
  LoginMethod,
  PrivySessionRequest,
  walletFromPrivyWallet,
} from './auth-session.types';

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
  private accessToken: string | null = null;

  readonly session$ = this.sessionSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(
    private readonly httpClient: HttpClient,
    private readonly router: Router
  ) {}

  get session(): AuthSession | null {
    return this.sessionSubject.value;
  }

  get config(): PublicAuthConfig | undefined {
    return window.craftscriptPrivyConfig;
  }

  get bridgeReady(): boolean {
    return Boolean(window.craftscriptPrivy);
  }

  get providerError(): string | undefined {
    return window.craftscriptPrivyError;
  }

  get enabledLoginMethods(): LoginMethod[] {
    const methods = this.config?.loginMethods ?? [];
    return methods.length > 0 ? methods : ['email'];
  }

  async refresh(): Promise<AuthSession | null> {
    const token = await this.currentAccessToken();
    if (!token) {
      this.sessionSubject.next(null);
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
      const session = { user: me.user, wallets: wallets.wallets };
      this.sessionSubject.next(session);
      return session;
    } catch {
      this.sessionSubject.next(null);
      return null;
    }
  }

  async login(authMethod: LoginMethod): Promise<AuthSession> {
    const bridge = window.craftscriptPrivy;
    if (!bridge) {
      throw new Error('Privy bridge is not available');
    }

    this.loadingSubject.next(true);
    try {
      const loginUser = await bridge.login(authMethod);
      const token = await bridge.getAccessToken();
      if (!token) {
        throw new Error('Privy access token is unavailable');
      }
      this.accessToken = token;

      const [currentUser, embeddedWallet] = await Promise.all([
        bridge.getUser().catch(() => null),
        bridge.getEmbeddedWallet().catch(() => null),
      ]);
      const body: PrivySessionRequest = {
        email: emailFromPrivyUser(currentUser || loginUser),
        authMethod,
        wallet: walletFromPrivyWallet(embeddedWallet),
      };

      const session = await firstValueFrom(
        this.httpClient.post<AuthSession>(
          `${environment.apiUrl}/api/v1/auth/privy/session`,
          body,
          {
            headers: this.authHeaders(token),
          }
        )
      );
      this.sessionSubject.next(session);
      return session;
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
    this.sessionSubject.next(null);
    await this.router.navigateByUrl('/login');
    return response.deletionAvailableAt;
  }

  async reloadWallets(): Promise<BackendWallet[]> {
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
    this.updateWallets(response.wallets);
    return response.wallets;
  }

  async setPrimaryWallet(walletId: string): Promise<BackendWallet> {
    const token = await this.currentAccessToken();
    if (!token) {
      throw new Error('No active session');
    }

    const response = await firstValueFrom(
      this.httpClient.patch<WalletResponse>(
        `${environment.apiUrl}/api/v1/wallets/${walletId}/primary`,
        {},
        { headers: this.authHeaders(token) }
      )
    );
    await this.reloadWallets();
    return response.wallet;
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
    this.accessToken = null;
    this.sessionSubject.next(null);
  }

  private updateWallets(wallets: BackendWallet[]): void {
    const session = this.sessionSubject.value;
    if (!session) {
      return;
    }
    this.sessionSubject.next({ ...session, wallets });
  }

  private async currentAccessToken(): Promise<string | null> {
    if (this.accessToken) {
      return this.accessToken;
    }

    const token = await window.craftscriptPrivy
      ?.getAccessToken()
      .catch(() => null);
    this.accessToken = token ?? null;
    return this.accessToken;
  }

  private authHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
