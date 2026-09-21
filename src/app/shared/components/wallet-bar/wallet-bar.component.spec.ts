import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import type { WalletAccount } from '@domains/wallet/models/wallet.models';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import type { WalletDrawerMode } from '@shared/mfe/wallets/wallets.service';
import { WalletBarComponent } from './wallet-bar.component';

describe('WalletBarComponent', () => {
  let component: WalletBarComponent;
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
    gateway = jasmine.createSpyObj<WalletGatewayBridgeService>(
      'WalletGatewayBridgeService',
      ['closeSwapReview', 'isExecutionInProgress', 'resetConnection'],
      { snapshot$: new BehaviorSubject(undefined) }
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
    component = TestBed.createComponent(WalletBarComponent).componentInstance;
    wallets.drawerMode.next('swap-review');
    component.isOpenWalletConnectMenu = true;
  });

  it('keeps the swap review open while wallet execution is in progress', () => {
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
});
