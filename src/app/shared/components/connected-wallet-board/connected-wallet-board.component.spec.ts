import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import {
  ActiveWalletFacade,
  type ActiveWalletState,
  type ActiveWalletBalances,
} from '@domains/wallet/application/active-wallet.facade';
import { MarketSnapshotsService } from '@shared/services/market-snapshots.service';
import { SparklineComponent } from '@shared/components/sparkline/sparkline.component';
import { ConnectedWalletBoardComponent } from './connected-wallet-board.component';

const wallet = {
  id: 'alice',
  providerWalletId: 'alice',
  address: 'alice.near',
  chainType: 'near',
  walletType: 'external',
  isPrimary: true,
};
const row = {
  walletId: 'alice',
  walletAddress: 'alice.near',
  chainType: 'near',
  network: 'near:mainnet',
  assetId: 'near:native',
  symbol: 'NEAR',
  decimals: 24,
  balanceRaw: '1250000000000000000000000',
  balanceDecimal: '1.25',
  source: 'near_rpc',
  fetchedAt: '2026-10-05T00:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  stale: false,
};

describe('shared active wallet details', () => {
  let fixture: ComponentFixture<ConnectedWalletBoardComponent>;
  let state: BehaviorSubject<ActiveWalletState>;
  let balances: BehaviorSubject<ActiveWalletBalances>;
  let refresh: jasmine.Spy;
  let revalidate: jasmine.Spy;
  let markets: jasmine.Spy;
  beforeEach(async () => {
    state = new BehaviorSubject<ActiveWalletState>({
      wallet,
      network: 'near:mainnet',
      connected: false,
      canSign: false,
      reason: 'Connect to sign',
    });
    balances = new BehaviorSubject<ActiveWalletBalances>({
      status: 'ready',
      account: wallet.address,
      network: 'near:mainnet',
      rows: [row],
    });
    refresh = jasmine.createSpy('refresh');
    revalidate = jasmine.createSpy('revalidate');
    markets = jasmine.createSpy('markets').and.returnValue(of([]));
    await TestBed.configureTestingModule({
      declarations: [ConnectedWalletBoardComponent, SparklineComponent],
      providers: [
        {
          provide: ActiveWalletFacade,
          useValue: {
            state$: state,
            balances$: balances,
            refreshBalances: refresh,
            revalidateBalances: revalidate,
            requestConnection: jasmine.createSpy('connect'),
          },
        },
        { provide: MarketSnapshotsService, useValue: { load: markets } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ConnectedWalletBoardComponent);
    fixture.detectChanges();
  });
  const text = () => document.body.textContent ?? '';
  it('renders shared holdings without a signer and does not fetch its own balances', () => {
    expect(text()).toContain('alice.near');
    expect(text()).toContain('1.25');
    expect(text()).toContain('Connect to sign');
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(markets).toHaveBeenCalledWith(['NEAR']);
    fixture.componentInstance.retryBalances();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('retains available rows during refresh and shows failures without empty copy', () => {
    balances.next({ ...balances.value, status: 'loading' });
    fixture.detectChanges();
    expect(text()).toContain('Loading balances');
    expect(text()).toContain('1.25');
    balances.next({
      ...balances.value,
      status: 'error',
      errorMessage: 'RPC unavailable',
    });
    fixture.detectChanges();
    expect(text()).toContain('RPC unavailable');
    expect(text()).not.toContain('No balance on this wallet');
  });
  it('switches identity and rows together when the shared source changes', () => {
    state.next({
      ...state.value,
      wallet: { ...wallet, id: 'bob', address: 'bob.near' },
    });
    balances.next({
      status: 'loading',
      account: 'bob.near',
      network: 'near:mainnet',
      rows: [],
    });
    fixture.detectChanges();
    expect(text()).toContain('bob.near');
    expect(text()).not.toContain('1.25');
    expect(text()).not.toContain('alice.near');
  });
  it('hides zero holdings only after a successful read', () => {
    balances.next({
      ...balances.value,
      rows: [{ ...row, balanceRaw: '0', balanceDecimal: '0' }],
    });
    fixture.detectChanges();
    expect(text()).toContain('No balance on this wallet detected');
  });
  it('preserves the actual EVM network instead of substituting mainnet', () => {
    state.next({
      ...state.value,
      network: 'eip155:11155111',
      wallet: {
        ...wallet,
        address: '0x' + 'a'.repeat(40),
        chainType: 'ethereum',
      },
    });
    fixture.detectChanges();
    expect(text()).toContain('Unsupported · chain 11155111');
    expect(text()).not.toContain('Ethereum · chain 1');
  });
});
