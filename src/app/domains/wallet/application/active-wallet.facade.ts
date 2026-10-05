import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession, BackendWallet } from '@core/auth/auth-session.types';
import type { WalletConnectionSnapshot } from '@mfe-contracts/wallet-mfe.types';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { nearNetworkForAddress } from '@shared/utils/network.utils';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  fromEvent,
  scan,
  switchMap,
} from 'rxjs';
import {
  ConnectedWalletBalancesFacade,
  type ConnectedWalletBalancesState,
} from './connected-wallet-balances.facade';

export type ActiveWalletState = {
  session?: AuthSession;
  userId?: string;
  sessionId?: string;
  wallet?: BackendWallet;
  snapshot?: WalletConnectionSnapshot;
  network?: string;
  restoring?: boolean;
  connected: boolean;
  canSign: boolean;
  verificationAction?: 'verify' | 'reconnect';
  reason: string;
};

export type ActiveWalletBalances = Omit<
  ConnectedWalletBalancesState,
  'status'
> & {
  status: ConnectedWalletBalancesState['status'] | 'idle';
};

/** Resolves the account-owned selection separately from a live signing connection. */
@Injectable({ providedIn: 'root' })
export class ActiveWalletFacade {
  private readonly stateSubject = new BehaviorSubject<ActiveWalletState>({
    connected: false,
    canSign: false,
    reason: 'Sign in to use your wallet.',
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly balancesSubject = new BehaviorSubject<ActiveWalletBalances>({
    status: 'idle',
    account: '',
    network: '',
    rows: [],
  });
  private loadedAt = 0;
  private balanceKey = '';
  private readonly refreshSubject = new BehaviorSubject(0);
  readonly state$ = this.stateSubject.asObservable();
  readonly balances$ = this.balancesSubject.asObservable();

  constructor(
    private readonly auth: AuthSessionService,
    private readonly gateway: WalletGatewayBridgeService,
    private readonly wallets: WalletsService,
    private readonly balances: ConnectedWalletBalancesFacade
  ) {
    combineLatest([this.auth.session$, this.gateway.snapshot$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([session, snapshot]) => {
        const wasConnected = this.state.connected;
        this.resolve(session, snapshot);
        if (!wasConnected && this.state.connected) this.revalidateBalances();
      });
    combineLatest([
      this.state$.pipe(
        map(state =>
          state.wallet && state.network
            ? {
                userId: state.userId,
                sessionId: state.sessionId,
                walletId: state.wallet.id,
                account: state.wallet.address,
                network: state.network,
              }
            : undefined
        ),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
      ),
      this.refreshSubject,
    ])
      .pipe(
        switchMap(([request]) => {
          const key = JSON.stringify(request) ?? '';
          const previous =
            key === this.balanceKey ? this.balancesSubject.value.rows : [];
          this.balanceKey = key;
          this.loadedAt = 0;
          if (!request)
            return of<ActiveWalletBalances>({
              status: 'idle',
              account: '',
              network: '',
              rows: [],
            });
          return this.balances.load(request).pipe(
            scan(
              (retained: ActiveWalletBalances, next): ActiveWalletBalances => {
                if (next.status === 'loading')
                  return { ...next, rows: retained.rows };
                if (next.status === 'error' && !next.sessionExpired)
                  return {
                    ...next,
                    rows: retained.rows.map(row => ({ ...row, stale: true })),
                  };
                return next;
              },
              {
                status: 'loading',
                account: request.account,
                network: request.network,
                rows: previous,
              }
            )
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(state => {
        if (state.sessionExpired) {
          this.auth.clear();
          return;
        }
        if (state.status === 'ready' || state.status === 'partial')
          this.loadedAt = Date.now();
        this.balancesSubject.next(state);
      });
    this.wallets.swapSettled
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshBalances());
    fromEvent(window, 'focus')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.revalidateBalances());
  }

  get state(): ActiveWalletState {
    return this.stateSubject.value;
  }

  requestConnection(): void {
    if (this.state.snapshot?.account && !this.state.connected)
      this.gateway.disconnectWallet();
    this.wallets.requestOpen('connect');
  }

  requestVerification(): void {
    if (this.state.verificationAction === 'reconnect') {
      this.gateway.disconnectWallet();
      this.wallets.requestOpen('connect');
    } else if (this.state.verificationAction === 'verify') {
      this.gateway.requestVerification();
    }
  }

  revalidateBalances(): void {
    const current = this.balancesSubject.value;
    if (current.status === 'loading') return;
    if (
      !this.loadedAt ||
      Date.now() - this.loadedAt >= 15_000 ||
      current.rows.some(
        row => row.stale || Date.parse(row.expiresAt) <= Date.now()
      )
    )
      this.refreshBalances();
  }

  refreshBalances(): void {
    this.refreshSubject.next(this.refreshSubject.value + 1);
  }

  private available(wallet: BackendWallet): boolean {
    return !wallet.deletedAt && (!wallet.status || wallet.status === 'active');
  }

  private matches(
    wallet: BackendWallet,
    snapshot: WalletConnectionSnapshot | null | undefined
  ): boolean {
    const address = snapshot?.account;
    if (
      !address ||
      !snapshot?.identity ||
      (wallet.chainType === 'ethereum'
        ? snapshot.identity.address.toLowerCase() !== address.toLowerCase()
        : snapshot.identity.address !== address)
    )
      return false;
    return (
      wallet.chainType === snapshot?.identity?.chainType &&
      (wallet.chainType === 'ethereum'
        ? wallet.address.toLowerCase() === address.toLowerCase()
        : wallet.address === address)
    );
  }

  private resolveNetwork(
    userId: string,
    wallet: BackendWallet,
    snapshot?: WalletConnectionSnapshot | null
  ): string | undefined {
    if (wallet.chainType === 'near')
      return nearNetworkForAddress(wallet.address);
    const key = `app:v1:wallet-network:${userId}:${wallet.id}`;
    const live =
      wallet.chainType === 'ethereum' && snapshot?.chainId != null
        ? `eip155:${snapshot.chainId}`
        : wallet.chainType === 'ton' && snapshot
          ? snapshot.chainId === -3
            ? 'ton:testnet'
            : 'ton:mainnet'
          : undefined;
    try {
      if (live) localStorage.setItem(key, live);
      const remembered = localStorage.getItem(key);
      if (
        wallet.chainType === 'ethereum' &&
        remembered &&
        /^eip155:[1-9]\d*$/.test(remembered)
      )
        return live ?? remembered;
      if (wallet.chainType === 'ton')
        return (
          live ?? (remembered === 'ton:testnet' ? remembered : 'ton:mainnet')
        );
    } catch {
      /* Network preferences are optional when browser storage is disabled. */
    }
    return live;
  }

  private resolve(
    session: AuthSession | null,
    snapshot: WalletConnectionSnapshot | null | undefined
  ): void {
    if (!session) {
      this.stateSubject.next({
        connected: false,
        canSign: false,
        reason: 'Sign in to use your wallet.',
      });
      return;
    }
    const available = session.wallets.filter(wallet => this.available(wallet));
    // The authenticated backend owns selection; connection restoration must not replace it.
    const wallet = available.find(item => item.isPrimary);
    const connected = Boolean(
      wallet &&
      this.matches(wallet, snapshot) &&
      snapshot?.status === 'connected'
    );
    const network = wallet
      ? this.resolveNetwork(
          session.user.id,
          wallet,
          connected ? snapshot : undefined
        )
      : undefined;
    const restoring =
      snapshot?.restorationStatus === 'pending' ||
      snapshot?.restorationStatus === 'restoring';
    const signingNetworkReady = Boolean(
      network &&
      (wallet?.chainType !== 'ethereum' ||
        (Number.isSafeInteger(snapshot?.chainId) &&
          (snapshot?.chainId ?? 0) > 0))
    );
    const reason = !wallet
      ? 'Connect a wallet linked to this account.'
      : !connected
        ? restoring
          ? 'Restoring wallet connection…'
          : 'Connect the active wallet to sign.'
        : !signingNetworkReady
          ? 'Select a supported wallet network.'
          : !snapshot?.isVerified
            ? 'Verify the active wallet before signing.'
            : snapshot.safetyStatus !== 'safe' && !snapshot.isBypassed
              ? 'Complete the wallet safety check.'
              : snapshot.linkStatus && snapshot.linkStatus !== 'linked'
                ? 'Link the active wallet to this account.'
                : '';
    this.stateSubject.next({
      session,
      userId: session.user.id,
      sessionId: session.user.sessionId,
      wallet,
      snapshot: snapshot ?? undefined,
      network,
      connected,
      restoring,
      verificationAction:
        connected &&
        signingNetworkReady &&
        snapshot &&
        !snapshot.isVerified &&
        (snapshot.safetyStatus === 'safe' || snapshot.isBypassed) &&
        (!snapshot.linkStatus || snapshot.linkStatus === 'linked')
          ? snapshot.executionState === 'operating.verificationPending'
            ? 'verify'
            : snapshot.executionState === 'operating.verificationFailed'
              ? 'reconnect'
              : undefined
          : undefined,
      canSign: !reason,
      reason,
    });
  }
}
