import { Injectable } from '@angular/core';
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
  filter,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
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
  connected: boolean;
  canSign: boolean;
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
  private readonly refreshSubject = new BehaviorSubject(0);
  readonly state$ = this.stateSubject.asObservable();
  readonly balances$ = combineLatest([
    this.state$.pipe(
      map(state =>
        state.connected && state.network && state.wallet
          ? {
              userId: state.userId,
              sessionId: state.sessionId,
              account: state.wallet.address,
              network: state.network,
            }
          : undefined
      ),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ),
    this.refreshSubject,
  ]).pipe(
    switchMap(([request]) =>
      request
        ? this.balances.load(request)
        : of<ActiveWalletBalances>({
            status: 'idle',
            account: '',
            network: '',
            rows: [],
          })
    ),
    tap(state => {
      if (state.sessionExpired) this.auth.clear();
    }),
    filter(state => !state.sessionExpired),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    private readonly auth: AuthSessionService,
    private readonly gateway: WalletGatewayBridgeService,
    private readonly wallets: WalletsService,
    private readonly balances: ConnectedWalletBalancesFacade
  ) {
    combineLatest([this.auth.session$, this.gateway.snapshot$]).subscribe(
      ([session, snapshot]) => {
        this.resolve(session, snapshot);
      }
    );
    this.wallets.swapSettled.subscribe(() => this.refreshBalances());
  }

  get state(): ActiveWalletState {
    return this.stateSubject.value;
  }

  requestConnection(): void {
    if (this.state.snapshot?.account && !this.state.connected)
      this.gateway.disconnectWallet();
    this.wallets.requestOpen();
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
    if (!address) return false;
    return (
      wallet.chainType === snapshot?.identity?.chainType &&
      (wallet.chainType === 'ethereum'
        ? wallet.address.toLowerCase() === address.toLowerCase()
        : wallet.address === address)
    );
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
    const wallet = available.find(item => item.isPrimary) ?? available[0];
    const connected = Boolean(
      wallet &&
      this.matches(wallet, snapshot) &&
      snapshot?.status === 'connected'
    );
    const network =
      connected && wallet
        ? wallet.chainType === 'near'
          ? nearNetworkForAddress(wallet.address)
          : wallet.chainType === 'ethereum' && snapshot?.chainId != null
            ? `eip155:${snapshot.chainId}`
            : undefined
        : undefined;
    const reason = !wallet
      ? 'Connect a wallet linked to this account.'
      : !connected
        ? 'Reconnect the active wallet to continue.'
        : !network
          ? 'This wallet network is not supported.'
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
      canSign: !reason,
      reason,
    });
  }
}
