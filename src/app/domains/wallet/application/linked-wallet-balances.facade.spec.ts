import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession, BackendWallet } from '@core/auth/auth-session.types';
import {
  WalletBalancesService,
  type WalletBalancesResult,
} from '@shared/services/wallet-balances.service';
import type { ExchangeToken } from '@shared/models/exchange-token.model';
import {
  LinkedWalletBalancesFacade,
  type LinkedBalancesState,
  walletSupportsNetwork,
} from './linked-wallet-balances.facade';

describe('linked wallet balances', () => {
  const wallet: BackendWallet = {
    id: 'near',
    address: 'alice.near',
    providerWalletId: 'near',
    chainType: 'near',
    walletType: 'external',
    isPrimary: true,
  };
  const session: AuthSession = {
    user: { id: 'user', sessionId: 'session', providerUserId: 'provider' },
    wallets: [wallet],
  };
  const token: ExchangeToken = {
    assetId: 'nep141:eth.near',
    symbol: 'ETH',
    name: 'Ethereum',
    color: '#fff',
    blockchain: 'near',
    sourceNetwork: 'near:mainnet',
  };
  let sessions: BehaviorSubject<AuthSession | null>;
  let balances: jasmine.SpyObj<WalletBalancesService>;
  let facade: LinkedWalletBalancesFacade;
  let state: LinkedBalancesState;
  beforeEach(() => {
    sessions = new BehaviorSubject<AuthSession | null>(session);
    balances = jasmine.createSpyObj('WalletBalancesService', [
      'loadBalancesWithMeta',
    ]);
    balances.loadBalancesWithMeta.and.callFake(request =>
      of({
        balances: (request?.assetIds ?? []).map(assetId => ({
          walletId: wallet.id,
          walletAddress: wallet.address,
          network: request?.network ?? '',
          chainType: wallet.chainType,
          assetId,
          symbol: 'ETH',
          decimals: 18,
          balanceRaw: '1000000000000000000',
          source: 'rpc',
          fetchedAt: '2030-01-01',
          expiresAt: '2030-01-02',
          stale: false,
        })),
        partial: false,
      })
    );
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSessionService,
          useValue: { session$: sessions, clear: () => sessions.next(null) },
        },
        { provide: WalletBalancesService, useValue: balances },
      ],
    });
    facade = TestBed.inject(LinkedWalletBalancesFacade);
    facade.state$.subscribe(value => (state = value));
  });
  it('loads only on demand and batches at 20 assets', () => {
    expect(balances.loadBalancesWithMeta).not.toHaveBeenCalled();
    facade.refresh(
      Array.from({ length: 41 }, (_, index) => ({
        ...token,
        assetId: `nep141:token${index}`,
      }))
    );
    expect(
      balances.loadBalancesWithMeta.calls
        .allArgs()
        .map(([request]) => request?.assetIds?.length)
    ).toEqual([20, 20, 1]);
    expect(state.holdings.length).toBe(41);
    expect(state.loading).toBeFalse();
    expect(state.incomplete).toBeFalse();
  });
  it('keeps successful batches when another batch fails', () => {
    balances.loadBalancesWithMeta.and.returnValues(
      of({ balances: [], partial: false }),
      throwError(() => new Error('offline'))
    );
    facade.refresh(
      Array.from({ length: 21 }, (_, index) => ({
        ...token,
        assetId: `token${index}`,
      }))
    );
    expect(state.incomplete).toBeTrue();
    expect(state.loading).toBeFalse();
    expect(state.holdings.length).toBe(21);
    expect(state.holdings.every(holding => !holding.balance)).toBeTrue();
  });
  it('rejects a response for a different wallet or network', () => {
    balances.loadBalancesWithMeta.and.returnValue(
      of({
        balances: [
          {
            walletId: 'other',
            walletAddress: wallet.address,
            network: 'near:mainnet',
            chainType: 'near',
            assetId: token.assetId,
            symbol: 'ETH',
            decimals: 18,
            balanceRaw: '100',
            source: 'rpc',
            fetchedAt: '2030-01-01',
            expiresAt: '2030-01-02',
            stale: false,
          },
        ],
        partial: false,
      })
    );
    facade.refresh([token]);
    expect(state.incomplete).toBeTrue();
    expect(state.holdings[0].balance).toBeUndefined();
  });
  it('cancels outstanding reads and clears holdings on logout and close', () => {
    const response = new Subject<WalletBalancesResult>();
    balances.loadBalancesWithMeta.and.returnValue(response);
    facade.refresh([token]);
    expect(state.loading).toBeTrue();
    sessions.next(null);
    expect(state.holdings).toEqual([]);
    response.next({ balances: [], partial: true });
    response.complete();
    expect(state.incomplete).toBeFalse();
    sessions.next(session);
    facade.close();
    expect(state.holdings).toEqual([]);
  });
  it('bounds requests across networks and skips incompatible wallets', () => {
    sessions.next({
      ...session,
      wallets: [
        { ...wallet, id: 'evm', address: '0x123', chainType: 'ethereum' },
      ],
    });
    const response = new Subject<WalletBalancesResult>();
    balances.loadBalancesWithMeta.and.returnValue(response);
    facade.refresh(
      Array.from({ length: 5 }, (_, i) => ({
        ...token,
        blockchain: 'eth',
        sourceNetwork: `eip155:${i + 1}`,
        assetId: `eth${i}`,
      }))
    );
    expect(balances.loadBalancesWithMeta.calls.count()).toBe(3);
    expect(walletSupportsNetwork(wallet, 'eip155:1')).toBeFalse();
    expect(
      walletSupportsNetwork(
        { ...wallet, deletedAt: '2026-01-01' },
        'near:mainnet'
      )
    ).toBeFalse();
  });
});
