import { ActiveWalletFacade } from '@domains/wallet/application/active-wallet.facade';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  flushMicrotasks,
  TestBed,
} from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import type { WalletAccount } from '@domains/wallet/models/wallet.models';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import type { WalletDrawerMode } from '@shared/mfe/wallets/wallets.service';
import type { WalletConnectionSnapshot } from '@mfe-contracts/wallet-mfe.types';
import { WalletBarComponent } from './wallet-bar.component';

describe('WalletBarComponent', () => {
  const connectedNearSnapshot: WalletConnectionSnapshot = {
    status: 'connected',
    account: 'alice.near',
    chainId: null,
    identity: {
      connectorId: 'near',
      address: 'alice.near',
      chainType: 'near',
      walletType: 'external',
    },
    isVerified: true,
    safetyStatus: 'safe',
    isBypassed: false,
    executionState: 'operating.idle',
  };
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
      [
        'closeSwapReview',
        'isExecutionInProgress',
        'resetConnection',
        'supportsConnectionSnapshots',
      ],
      { snapshot$: snapshots }
    );
    gateway.supportsConnectionSnapshots.and.returnValue(true);
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
        { provide: ActiveWalletFacade, useValue: { state$: of({}) } },
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

  [true, false].forEach(accountFirst => {
    it(`keeps the unlinked NEAR drawer open with ${accountFirst ? 'account-first' : 'snapshot-first'} delivery`, fakeAsync(() => {
      component.hostModal = true;
      wallets.drawerMode.next('wallet');
      if (accountFirst) {
        wallets.account.next({ account: 'alice.near', chainId: null });
        expect(component.isOpenWalletConnectMenu).toBeTrue();
      }
      snapshots.next({ ...connectedNearSnapshot, linkStatus: 'unlinked' });
      if (!accountFirst) {
        wallets.account.next({ account: 'alice.near', chainId: null });
      }
      flushMicrotasks();

      expect(component.needsNearWalletLink).toBeTrue();
      expect(component.isOpenWalletConnectMenu).toBeTrue();
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('app-connected-wallet-board')
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector('.wallet-bar__mfe-host--hidden')
      ).toBeNull();
    }));
  });

  it('closes on a connected snapshot from an older NEAR remote without link status', () => {
    component.hostModal = true;
    wallets.drawerMode.next('wallet');
    wallets.account.next({ account: 'alice.near', chainId: null });

    expect(component.isOpenWalletConnectMenu).toBeTrue();
    snapshots.next(connectedNearSnapshot);

    expect(component.needsNearWalletLink).toBeFalse();
    expect(component.isOpenWalletConnectMenu).toBeFalse();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-connected-wallet-board')
    ).toBeNull();
    component.hasActiveWallet = true;
    component.handleOpenWalletMenu();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-connected-wallet-board')
    ).not.toBeNull();
  });

  it('keeps account-based auto-close for a legacy remote without snapshots', fakeAsync(() => {
    component.hostModal = true;
    wallets.drawerMode.next('wallet');
    gateway.supportsConnectionSnapshots.and.returnValue(false);

    wallets.account.next({ account: 'alice.near', chainId: null });
    expect(component.isOpenWalletConnectMenu).toBeTrue();
    flushMicrotasks();

    expect(component.isOpenWalletConnectMenu).toBeFalse();
  }));

  it('waits for a snapshot API returned after a synchronous account callback', fakeAsync(() => {
    component.hostModal = true;
    wallets.drawerMode.next('wallet');
    gateway.supportsConnectionSnapshots.and.returnValue(false);

    wallets.account.next({ account: 'alice.near', chainId: null });
    gateway.supportsConnectionSnapshots.and.returnValue(true);
    flushMicrotasks();

    expect(component.isOpenWalletConnectMenu).toBeTrue();
    snapshots.next({ ...connectedNearSnapshot, linkStatus: 'unlinked' });

    expect(component.needsNearWalletLink).toBeTrue();
    expect(component.isOpenWalletConnectMenu).toBeTrue();
  }));
});
