/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import {
  ConnectedWalletBalancesFacade,
  type ConnectedWalletBalancesState,
} from '@domains/wallet/application/connected-wallet-balances.facade';
import type { WalletConnectionSnapshot } from '@mfe-contracts/wallet-mfe.types';
import { SparklineComponent } from '@shared/components/sparkline/sparkline.component';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { ConnectedWalletBoardComponent } from './connected-wallet-board.component';

describe('ConnectedWalletBoardComponent', () => {
  const account = '0x1111111111111111111111111111111111111111';
  const evmSnapshot: WalletConnectionSnapshot = {
    status: 'connected',
    account,
    chainId: 1,
    identity: {
      connectorId: 'metamask',
      address: account,
      chainType: 'ethereum',
      walletType: 'external',
    },
    isVerified: true,
    safetyStatus: 'safe',
    isBypassed: false,
    executionState: 'operating.idle',
  };
  const nearSnapshot: WalletConnectionSnapshot = {
    ...evmSnapshot,
    account: 'alice.near',
    chainId: null,
    identity: {
      connectorId: 'near',
      address: 'alice.near',
      chainType: 'near',
      walletType: 'external',
    },
  };
  const tonSnapshot: WalletConnectionSnapshot = {
    ...evmSnapshot,
    account: `EQ${'a'.repeat(46)}`,
    chainId: -3,
    identity: {
      connectorId: 'tonkeeper',
      address: `EQ${'a'.repeat(46)}`,
      chainType: 'ton',
      walletType: 'external',
    },
  };
  const readyBalances: ConnectedWalletBalancesState = {
    status: 'ready',
    account,
    network: 'eip155:1',
    rows: [
      {
        walletId: null,
        walletAddress: account,
        chainType: 'ethereum',
        network: 'eip155:1',
        assetId: 'eth',
        symbol: 'ETH',
        decimals: 18,
        balanceRaw: '1000000000000000000',
        balanceDecimal: '1.25',
        source: 'rpc_batch',
        fetchedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-01-01T00:01:00Z',
        stale: false,
      },
    ],
  };

  let fixture: ComponentFixture<ConnectedWalletBoardComponent>;
  let snapshot$: BehaviorSubject<WalletConnectionSnapshot | undefined>;
  let balances$: BehaviorSubject<ConnectedWalletBalancesState>;
  let loadBalances: jasmine.Spy;
  let disconnectWallet: jasmine.Spy;

  beforeEach(async () => {
    snapshot$ = new BehaviorSubject<WalletConnectionSnapshot | undefined>(
      evmSnapshot
    );
    balances$ = new BehaviorSubject<ConnectedWalletBalancesState>({
      status: 'loading',
      account,
      network: 'eip155:1',
      rows: [],
    });
    loadBalances = jasmine
      .createSpy('load')
      .and.returnValue(balances$.asObservable());
    disconnectWallet = jasmine.createSpy('disconnectWallet');

    await TestBed.configureTestingModule({
      declarations: [ConnectedWalletBoardComponent, SparklineComponent],
      providers: [
        {
          provide: WalletGatewayBridgeService,
          useValue: {
            snapshot$,
            disconnectWallet,
          },
        },
        {
          provide: ConnectedWalletBalancesFacade,
          useValue: { load: loadBalances },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectedWalletBoardComponent);
    fixture.detectChanges();
  });

  it('asks the host facade for EVM balances and paints BFF rows', () => {
    expect(loadBalances).toHaveBeenCalledWith({
      account,
      network: 'eip155:1',
    });

    balances$.next(readyBalances);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('0x1111...1111');
    expect(text).toContain('ETH');
    expect(text).toContain('1.25');
    expect(text).not.toContain('$5,848.49');
    expect(text).toContain('Mock markets');
    expect(fixture.nativeElement.querySelectorAll('app-sparkline').length).toBe(
      1
    );
  });

  it('reloads balances for the selected EVM network', () => {
    const chips = fixture.nativeElement.querySelectorAll(
      '.connected-wallet-board__chip'
    ) as NodeListOf<HTMLButtonElement>;

    chips[1].click();
    fixture.detectChanges();

    expect(loadBalances).toHaveBeenCalledWith({
      account,
      network: 'eip155:42161',
    });
  });

  it('loads balances for a connected NEAR account', () => {
    snapshot$.next(nearSnapshot);
    fixture.detectChanges();

    expect(loadBalances).toHaveBeenCalledWith({
      account: 'alice.near',
      network: 'near:mainnet',
    });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('alice.near');
    expect(text).toContain('Loading balances...');
    expect(
      fixture.nativeElement.querySelectorAll('.connected-wallet-board__chip')
        .length
    ).toBe(0);
  });

  it('does not reuse a response after the account changes', () => {
    const firstRequest = balances$;
    const secondRequest = new BehaviorSubject<ConnectedWalletBalancesState>({
      status: 'loading',
      account: '0x2222222222222222222222222222222222222222',
      network: 'eip155:1',
      rows: [],
    });
    loadBalances.and.returnValue(secondRequest.asObservable());

    snapshot$.next({
      ...evmSnapshot,
      account: '0x2222222222222222222222222222222222222222',
    });
    firstRequest.next(readyBalances);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('1.25');
    expect(text).toContain('Loading balances...');
  });

  it('uses the Tonkeeper network identity for TON testnet', () => {
    snapshot$.next(tonSnapshot);
    fixture.detectChanges();

    expect(loadBalances).toHaveBeenCalledWith({
      account: tonSnapshot.account,
      network: 'ton:testnet',
    });
  });

  it('disconnects through the wallet gateway', () => {
    const button = fixture.nativeElement.querySelector(
      '.connected-wallet-board__disconnect'
    ) as HTMLButtonElement;

    button.click();

    expect(disconnectWallet).toHaveBeenCalledTimes(1);
  });
});
