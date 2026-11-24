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
  walletSupportsBalanceNetwork,
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
  it('uses balanceNetwork without inventing funding support', () => {
    const account = {
      ...wallet,
      id: 'evm',
      address: '0x' + 'a'.repeat(40),
      chainType: 'ethereum',
    };
    sessions.next({ ...session, wallets: [account] });
    balances.loadBalancesWithMeta.and.returnValue(
      of({
        balances: [
          {
            walletId: account.id,
            walletAddress: account.address,
            network: 'oneclick:hypercore',
            chainType: account.chainType,
            assetId: 'hip1',
            symbol: 'USDC',
            decimals: 8,
            balanceRaw: '100000000',
            source: 'public_chain_api',
            fetchedAt: '2030-01-01',
            expiresAt: '2030-01-02',
            stale: false,
          },
        ],
        partial: false,
      })
    );
    const hip = {
      ...token,
      assetId: 'hip1',
      sourceNetwork: undefined,
      balanceNetwork: 'oneclick:hypercore',
    };
    facade.refresh([hip]);
    expect(balances.loadBalancesWithMeta).toHaveBeenCalledWith({
      walletAddress: account.address,
      network: 'oneclick:hypercore',
      assetIds: ['hip1'],
    });
    expect(hip.sourceNetwork).toBeUndefined();
    expect(state.holdings[0].balance?.balanceRaw).toBe('100000000');
    expect(state.incomplete).toBeFalse();
    expect(walletSupportsNetwork(account, 'oneclick:hypercore')).toBeFalse();
    expect(
      walletSupportsBalanceNetwork(wallet, 'oneclick:hypercore')
    ).toBeFalse();
    expect(
      walletSupportsBalanceNetwork(account, 'oneclick:stellar')
    ).toBeFalse();
    expect(
      walletSupportsBalanceNetwork(
        { ...wallet, chainType: 'stellar' },
        'oneclick:stellar'
      )
    ).toBeTrue();
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
  it('passes balance diagnostics to token selection and clears them on close', () => {
    balances.loadBalancesWithMeta.and.returnValue(
      of({
        balances: [],
        partial: true,
        errorMessages: [
          'The balance provider is rate limiting requests. Try again shortly.',
        ],
      })
    );
    facade.refresh([token]);
    expect(state.incomplete).toBeTrue();
    expect(state.errorMessage).toContain('rate limiting');
    facade.close();
    expect(state.errorMessage).toBeUndefined();
  });
  it('deduplicates diagnostics across three networks', () => {
    sessions.next({
      ...session,
      wallets: [{ ...wallet, chainType: 'ethereum', address: '0x123' }],
    });
    balances.loadBalancesWithMeta.and.returnValues(
      of({ balances: [], partial: true, errorMessages: ['Rate limited.'] }),
      of({ balances: [], partial: true, errorMessages: ['Timed out.'] }),
      of({ balances: [], partial: true, errorMessages: ['Rate limited.'] })
    );
    facade.refresh(
      ['eip155:1', 'eip155:56', 'eip155:8453'].map(sourceNetwork => ({
        ...token,
        sourceNetwork,
      }))
    );
    expect(state.errorMessage).toBe('Rate limited. Timed out.');
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
