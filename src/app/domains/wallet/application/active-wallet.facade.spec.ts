import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject, startWith } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession, BackendWallet } from '@core/auth/auth-session.types';
import type { WalletConnectionSnapshot } from '@mfe-contracts/wallet-mfe.types';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import {
  ActiveWalletFacade,
  type ActiveWalletBalances,
} from './active-wallet.facade';
import {
  ConnectedWalletBalancesFacade,
  type ConnectedWalletBalancesState,
} from './connected-wallet-balances.facade';

const alice: BackendWallet = {
  id: 'alice',
  address: 'alice.near',
  chainType: 'near',
  walletType: 'external',
  providerWalletId: 'alice',
  isPrimary: true,
};
const bob: BackendWallet = {
  ...alice,
  id: 'bob',
  address: 'bob.near',
  isPrimary: false,
};
const session: AuthSession = {
  user: { id: 'user', providerUserId: 'provider', sessionId: 'session' },
  wallets: [alice, bob],
};
function connected(address = 'alice.near'): WalletConnectionSnapshot {
  return {
    status: 'connected',
    account: address,
    chainId: null,
    isVerified: true,
    safetyStatus: 'safe',
    isBypassed: false,
    executionState: 'operating.idle',
    identity: {
      connectorId: 'near',
      address,
      chainType: 'near',
      walletType: 'external',
    },
  };
}

describe('backend-owned active wallet', () => {
  let sessions: BehaviorSubject<AuthSession | null>;
  let snapshots: BehaviorSubject<WalletConnectionSnapshot | undefined>;
  let settled: Subject<unknown>;
  let facade: ActiveWalletFacade;
  let verify: jasmine.Spy;
  let disconnect: jasmine.Spy;
  let open: jasmine.Spy;
  let transport: jasmine.SpyObj<ConnectedWalletBalancesFacade>;
  let requests: Subject<ConnectedWalletBalancesState>[];
  let states: ActiveWalletBalances[];

  beforeEach(() => {
    sessions = new BehaviorSubject<AuthSession | null>(null);
    snapshots = new BehaviorSubject<WalletConnectionSnapshot | undefined>(
      undefined
    );
    settled = new Subject();
    verify = jasmine.createSpy('requestVerification');
    disconnect = jasmine.createSpy('disconnectWallet');
    open = jasmine.createSpy('requestOpen');
    requests = [];
    states = [];
    transport = jasmine.createSpyObj('ConnectedWalletBalancesFacade', ['load']);
    transport.load.and.callFake(request => {
      const response = new Subject<ConnectedWalletBalancesState>();
      requests.push(response);
      return response.pipe(
        startWith<ConnectedWalletBalancesState>({
          ...request,
          status: 'loading',
          rows: [],
        })
      );
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSessionService,
          useValue: { session$: sessions, clear: () => sessions.next(null) },
        },
        {
          provide: WalletGatewayBridgeService,
          useValue: {
            snapshot$: snapshots,
            requestVerification: verify,
            disconnectWallet: disconnect,
          },
        },
        {
          provide: WalletsService,
          useValue: { swapSettled: settled, requestOpen: open },
        },
        { provide: ConnectedWalletBalancesFacade, useValue: transport },
      ],
    });
    facade = TestBed.inject(ActiveWalletFacade);
  });

  function watch() {
    return facade.balances$.subscribe(state => states.push(state));
  }
  function last() {
    return states[states.length - 1];
  }

  it('loads automatically once session and the selected live wallet are ready, regardless of ordering', () => {
    const subscription = watch();
    snapshots.next(connected());
    expect(transport.load).not.toHaveBeenCalled();
    sessions.next(session);
    expect(transport.load).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        account: 'alice.near',
        network: 'near:mainnet',
        userId: 'user',
      })
    );
    expect(facade.state.canSign).toBeTrue();
    expect(last().status).toBe('loading');
    snapshots.next({ ...connected(), executionState: 'completed' });
    sessions.next({ ...session });
    const second = watch();
    expect(transport.load).toHaveBeenCalledTimes(1);
    second.unsubscribe();
    subscription.unsubscribe();
  });

  it('restores backend selection instead of another connected wallet or initialization default', () => {
    const subscription = watch();
    sessions.next({
      ...session,
      wallets: [
        { ...alice, isPrimary: false },
        { ...bob, isPrimary: true },
      ],
    });
    snapshots.next(connected());
    expect(facade.state.wallet?.id).toBe('bob');
    expect(facade.state.canSign).toBeFalse();
    expect(facade.state.reason).toContain('Reconnect');
    expect(transport.load).not.toHaveBeenCalled();
    snapshots.next(connected('bob.near'));
    expect(facade.state.canSign).toBeTrue();
    expect(transport.load).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it('cancels pending balances on wallet changes and ignores stale responses', () => {
    const subscription = watch();
    sessions.next(session);
    snapshots.next(connected());
    sessions.next({
      ...session,
      wallets: [
        { ...alice, isPrimary: false },
        { ...bob, isPrimary: true },
      ],
    });
    expect(requests[0].observed).toBeFalse();
    expect(last().rows).toEqual([]);
    snapshots.next(connected('bob.near'));
    requests[0].next({
      status: 'ready',
      account: 'alice.near',
      network: 'near:mainnet',
      rows: [],
    });
    expect(last().account).toBe('bob.near');
    expect(last().status).toBe('loading');
    requests[1].next({
      status: 'ready',
      account: 'bob.near',
      network: 'near:mainnet',
      rows: [],
    });
    expect(last().status).toBe('ready');
    subscription.unsubscribe();
  });

  it('scopes balances to user and session, clears on logout, and rejects unavailable wallets', () => {
    const subscription = watch();
    sessions.next(session);
    snapshots.next(connected());
    sessions.next({ ...session, user: { ...session.user, id: 'other-user' } });
    expect(transport.load).toHaveBeenCalledTimes(2);
    expect(requests[0].observed).toBeFalse();
    sessions.next(null);
    expect(last().status).toBe('idle');
    expect(facade.state.canSign).toBeFalse();
    sessions.next({
      ...session,
      wallets: [{ ...alice, deletedAt: '2026-01-01' }],
    });
    expect(facade.state.wallet).toBeUndefined();
    expect(transport.load).toHaveBeenCalledTimes(2);
    subscription.unsubscribe();
  });

  it('refreshes after settlement and on manual retry, and exposes failures without old balances', () => {
    const subscription = watch();
    sessions.next(session);
    snapshots.next(connected());
    requests[0].next({
      status: 'error',
      account: 'alice.near',
      network: 'near:mainnet',
      rows: [],
      errorMessage: 'Unavailable',
    });
    expect(last().errorMessage).toBe('Unavailable');
    facade.refreshBalances();
    expect(last().status).toBe('loading');
    settled.next({ traceId: 'swap', status: 'SUCCESS' });
    expect(transport.load).toHaveBeenCalledTimes(3);
    subscription.unsubscribe();
  });

  it('matches EVM addresses regardless of casing while requiring the correct chain', () => {
    const address = '0x' + 'aB'.repeat(20);
    sessions.next({
      ...session,
      wallets: [{ ...alice, address, chainType: 'ethereum' }],
    });
    snapshots.next({
      ...connected(address.toLowerCase()),
      chainId: 1,
      identity: {
        address,
        chainType: 'ethereum',
        walletType: 'external',
        connectorId: 'metamask',
      },
    });
    expect(facade.state.connected).toBeTrue();
    expect(facade.state.network).toBe('eip155:1');
    snapshots.next(connected(address));
    expect(facade.state.connected).toBeFalse();
  });

  it('offers explicit verification, waits for success, and reconnects after rejection', () => {
    sessions.next(session);
    const pending = {
      ...connected(),
      isVerified: false,
      executionState: 'operating.verificationPending',
    };
    snapshots.next(pending);
    expect(verify).not.toHaveBeenCalled();
    expect(facade.state.canSign).toBeFalse();
    expect(facade.state.verificationAction).toBe('verify');
    facade.requestVerification();
    expect(verify).toHaveBeenCalledTimes(1);
    snapshots.next({
      ...pending,
      executionState: 'operating.verifyingSignature',
    });
    expect(facade.state.verificationAction).toBeUndefined();
    facade.requestVerification();
    expect(verify).toHaveBeenCalledTimes(1);
    snapshots.next({
      ...pending,
      executionState: 'operating.verificationFailed',
    });
    expect(facade.state.verificationAction).toBe('reconnect');
    facade.requestVerification();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
    snapshots.next(connected());
    expect(facade.state.canSign).toBeTrue();
    expect(facade.state.verificationAction).toBeUndefined();
  });

  it('does not verify unsafe, unlinked, mismatched or signed-out wallets', () => {
    sessions.next(session);
    const pending = {
      ...connected(),
      isVerified: false,
      executionState: 'operating.verificationPending',
    };
    for (const snapshot of [
      { ...pending, safetyStatus: 'unsafe' as const },
      { ...pending, linkStatus: 'unlinked' as const },
      { ...pending, account: 'bob.near' },
    ]) {
      snapshots.next(snapshot);
      expect(facade.state.verificationAction).toBeUndefined();
      facade.requestVerification();
    }
    sessions.next(null);
    snapshots.next(pending);
    facade.requestVerification();
    expect(verify).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('clears an expired session and distinguishes connection from signing readiness', () => {
    const subscription = watch();
    sessions.next(session);
    snapshots.next({ ...connected(), isVerified: false });
    expect(facade.state.connected).toBeTrue();
    expect(facade.state.canSign).toBeFalse();
    expect(facade.state.reason).toContain('Verify');
    requests[0].next({
      status: 'error',
      account: 'alice.near',
      network: 'near:mainnet',
      rows: [],
      sessionExpired: true,
    });
    expect(last().status).toBe('idle');
    expect(facade.state.reason).toContain('Sign in');
    subscription.unsubscribe();
  });
});
