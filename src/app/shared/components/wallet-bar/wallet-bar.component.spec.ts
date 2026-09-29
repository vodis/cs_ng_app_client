import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import type { WalletAccount } from '@domains/wallet/models/wallet.models';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import type { WalletDrawerMode } from '@shared/mfe/wallets/wallets.service';
import type { WalletConnectionSnapshot } from '@mfe-contracts/wallet-mfe.types';
import { WalletBarComponent } from './wallet-bar.component';

describe('WalletBarComponent', () => {
  let component: WalletBarComponent;
  let fixture: ComponentFixture<WalletBarComponent>;
  let snapshots: BehaviorSubject<WalletConnectionSnapshot | undefined>;
  let gateway: jasmine.SpyObj<WalletGatewayBridgeService>;
  let wallets: Pick<
    WalletsService,
    | 'account'
    | 'closeRequested'
    | 'openRequested'
    | 'drawerMode'
    | 'clearCloseRequest'
    | 'clearOpenRequest'
    | 'requestOpen'
  >;

  beforeEach(() => {
    snapshots = new BehaviorSubject<WalletConnectionSnapshot | undefined>(
      undefined
    );
    gateway = jasmine.createSpyObj<WalletGatewayBridgeService>(
      'WalletGatewayBridgeService',
      ['closeSwapReview', 'isExecutionInProgress', 'resetConnection'],
      { snapshot$: snapshots }
    );
    wallets = {
      account: new BehaviorSubject<WalletAccount | undefined>(undefined),
      closeRequested: new BehaviorSubject(false),
      openRequested: new BehaviorSubject(false),
      drawerMode: new BehaviorSubject<WalletDrawerMode>('wallet'),
      clearCloseRequest: jasmine.createSpy('clearCloseRequest'),
      clearOpenRequest: jasmine.createSpy('clearOpenRequest'),
      requestOpen: jasmine.createSpy('requestOpen'),
    };

    TestBed.configureTestingModule({
      declarations: [WalletBarComponent],
      providers: [
        { provide: WalletGatewayBridgeService, useValue: gateway },
        { provide: WalletsService, useValue: wallets },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(WalletBarComponent);
    component = fixture.componentInstance;
    wallets.drawerMode.next('swap-review');
    component.isOpenWalletConnectMenu = true;
  });

  it('keeps the swap review open while wallet execution or settlement is in progress', () => {
    gateway.isExecutionInProgress.and.returnValue(true);

    component.handleCloseWalletMenu();

    expect(gateway.closeSwapReview).not.toHaveBeenCalled();
    expect(wallets.drawerMode.value).toBe('swap-review');
    expect(component.isOpenWalletConnectMenu).toBeTrue();
  });

  it('closes an idle swap review', () => {
    gateway.isExecutionInProgress.and.returnValue(false);

    component.handleCloseWalletMenu();

    expect(gateway.closeSwapReview).toHaveBeenCalledTimes(1);
    expect(wallets.drawerMode.value).toBe('wallet');
    expect(component.isOpenWalletConnectMenu).toBeFalse();
  });

  it('keeps the wallet drawer open for a connected NEAR wallet awaiting explicit linking', () => {
    component.hostModal = true;
    wallets.drawerMode.next('wallet');
    snapshots.next({
      status: 'connected',
      account: 'alice.near',
      chainId: null,
      identity: {
        connectorId: 'near',
        address: 'alice.near',
        chainType: 'near',
        walletType: 'external',
      },
      linkStatus: 'unlinked',
      isVerified: true,
      safetyStatus: 'safe',
      isBypassed: false,
      executionState: 'operating.idle',
    });
    wallets.account.next({ account: 'alice.near', chainId: null });

    expect(component.needsNearWalletLink).toBeTrue();
    expect(component.isOpenWalletConnectMenu).toBeTrue();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-connected-wallet-board')
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.wallet-bar__mfe-host--hidden')
    ).toBeNull();
  });
});
