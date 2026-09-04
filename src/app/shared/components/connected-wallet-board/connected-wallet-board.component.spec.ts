/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import {
  IDLE_WALLET_BALANCES_SNAPSHOT,
  type WalletBalancesSnapshot,
} from '@mfe-contracts/wallet-balances.types';
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
  const readyBalances: WalletBalancesSnapshot = {
    status: 'ready',
    account,
    chainId: 1,
    rows: [
      {
        walletAddress: account,
        chainType: 'ethereum',
        network: 'eip155:1',
        chainId: 1,
        assetId: 'eth',
        symbol: 'ETH',
        decimals: 18,
        balanceRaw: '1000000000000000000',
        balanceDecimal: '1.25',
        fetchedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-01-01T00:01:00Z',
        stale: false,
      },
    ],
  };

  let fixture: ComponentFixture<ConnectedWalletBoardComponent>;
  let snapshot$: BehaviorSubject<WalletConnectionSnapshot | undefined>;
  let balances$: BehaviorSubject<WalletBalancesSnapshot>;
  let requestBalancesSync: jasmine.Spy;
  let disconnectWallet: jasmine.Spy;

  beforeEach(async () => {
    snapshot$ = new BehaviorSubject<WalletConnectionSnapshot | undefined>(
      evmSnapshot
    );
    balances$ = new BehaviorSubject<WalletBalancesSnapshot>(
      IDLE_WALLET_BALANCES_SNAPSHOT
    );
    requestBalancesSync = jasmine.createSpy('requestBalancesSync');
    disconnectWallet = jasmine.createSpy('disconnectWallet');

    await TestBed.configureTestingModule({
      declarations: [ConnectedWalletBoardComponent, SparklineComponent],
      providers: [
        {
          provide: WalletGatewayBridgeService,
          useValue: {
            snapshot$,
            balances$,
            requestBalancesSync,
            disconnectWallet,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectedWalletBoardComponent);
    fixture.detectChanges();
  });

  it('asks the gateway for EVM balances and paints BFF rows', () => {
    expect(requestBalancesSync).toHaveBeenCalledWith(1);

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

  it('asks the gateway to sync the selected EVM network', () => {
    const chips = fixture.nativeElement.querySelectorAll(
      '.connected-wallet-board__chip'
    ) as NodeListOf<HTMLButtonElement>;

    chips[1].click();
    fixture.detectChanges();

    expect(requestBalancesSync).toHaveBeenCalledWith(42161);
  });

  it('does not invent NEAR amounts while the gateway has no balance feed', () => {
    snapshot$.next(nearSnapshot);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('alice.near');
    expect(text).toContain('Balances for this network are not available yet.');
    expect(text).not.toContain('84.1200');
    expect(
      fixture.nativeElement.querySelectorAll('.connected-wallet-board__chip')
        .length
    ).toBe(0);
  });

  it('disconnects through the wallet gateway', () => {
    const button = fixture.nativeElement.querySelector(
      '.connected-wallet-board__disconnect'
    ) as HTMLButtonElement;

    button.click();

    expect(disconnectWallet).toHaveBeenCalledTimes(1);
  });
});
