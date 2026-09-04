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

  let fixture: ComponentFixture<ConnectedWalletBoardComponent>;
  let snapshot$: BehaviorSubject<WalletConnectionSnapshot | undefined>;
  let requestBalancesSync: jasmine.Spy;
  let disconnectWallet: jasmine.Spy;

  beforeEach(async () => {
    snapshot$ = new BehaviorSubject<WalletConnectionSnapshot | undefined>(
      evmSnapshot
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
            balances$: new BehaviorSubject<WalletBalancesSnapshot>(
              IDLE_WALLET_BALANCES_SNAPSHOT
            ),
            requestBalancesSync,
            disconnectWallet,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectedWalletBoardComponent);
    fixture.detectChanges();
  });

  it('paints the mock EVM market table with a Mock badge', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('0x1111...1111');
    expect(text).toContain('$5,848.49');
    expect(text).toContain('ETH');
    expect(text).toContain('USDC');
    expect(text).toContain('WETH');
    expect(text).toContain('$3,285.40');
    expect(text).toContain('Mock');
    expect(
      fixture.nativeElement.querySelectorAll('.connected-wallet-board__chip')
        .length
    ).toBe(4);
    expect(fixture.nativeElement.querySelectorAll('app-sparkline').length).toBe(
      3
    );
  });

  it('switches mock rows and asks the gateway to sync the selected EVM network', () => {
    const chips = fixture.nativeElement.querySelectorAll(
      '.connected-wallet-board__chip'
    ) as NodeListOf<HTMLButtonElement>;

    chips[1].click();
    fixture.detectChanges();

    expect(requestBalancesSync).toHaveBeenCalledOnceWith(42161);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ARB');
    expect(text).toContain('$1,944.78');
  });

  it('shows mock NEAR rows without EVM network chips', () => {
    snapshot$.next(nearSnapshot);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('alice.near');
    expect(text).toContain('NEAR');
    expect(text).toContain('$493.99');
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
