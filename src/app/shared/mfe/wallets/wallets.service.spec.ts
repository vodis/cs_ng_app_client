/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { ProductEventsService } from '@core/product-events/product-events.service';
import { LastConnectedWallet } from '@domains/wallet/models/wallet.models';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  let service: WalletsService;
  let productEvents: jasmine.SpyObj<ProductEventsService>;
  const storageKey = 'cs-host.last-connected-wallet.v1';

  const wallet: LastConnectedWallet = {
    account: '0x6e1a000000000000000000000000000000007690',
    chainId: 1,
    walletType: 'embedded',
    source: 'privy',
    connectorId: 'privy',
  };

  beforeEach(() => {
    window.sessionStorage.clear();
    productEvents = jasmine.createSpyObj<ProductEventsService>(
      'ProductEventsService',
      ['recordFailure']
    );

    TestBed.configureTestingModule({
      providers: [
        WalletsService,
        { provide: ProductEventsService, useValue: productEvents },
      ],
    });

    service = TestBed.inject(WalletsService);
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('persists and restores the last connected wallet', () => {
    service.rememberConnectedWallet(wallet);

    expect(service.lastConnected.value).toEqual(wallet);
    expect(
      JSON.parse(window.sessionStorage.getItem(storageKey) ?? '{}')
    ).toEqual(wallet);
  });

  it('hydrates lastConnected from sessionStorage on construction', () => {
    window.sessionStorage.setItem(storageKey, JSON.stringify(wallet));

    const fresh = new WalletsService(productEvents);

    expect(fresh.lastConnected.value).toEqual(wallet);
  });

  it('ignores invalid sessionStorage payloads when hydrating', () => {
    window.sessionStorage.setItem(storageKey, '{not-json');
    const fresh = new WalletsService(productEvents);
    expect(fresh.lastConnected.value).toBeUndefined();
  });

  it('clears last connected wallet from memory and storage', () => {
    service.rememberConnectedWallet(wallet);
    service.clearLastConnectedWallet();

    expect(service.lastConnected.value).toBeUndefined();
    expect(window.sessionStorage.getItem(storageKey)).toBeNull();
  });

  it('records a product event when persist fails', () => {
    spyOn(window.sessionStorage, 'setItem').and.throwError(
      'QuotaExceededError'
    );

    service.rememberConnectedWallet(wallet);

    expect(service.lastConnected.value).toEqual(wallet);
    expect(productEvents.recordFailure).toHaveBeenCalledOnceWith(
      'wallet.last_connected.persist',
      jasmine.any(Error),
      {
        metadata: {
          action: 'set',
          storage: 'sessionStorage',
          walletType: 'embedded',
          connectorId: 'privy',
        },
      }
    );
  });

  it('records a product event when clear fails', () => {
    service.rememberConnectedWallet(wallet);
    spyOn(window.sessionStorage, 'removeItem').and.throwError(
      'storage blocked'
    );

    service.clearLastConnectedWallet();

    expect(service.lastConnected.value).toBeUndefined();
    expect(productEvents.recordFailure).toHaveBeenCalledOnceWith(
      'wallet.last_connected.persist',
      jasmine.any(Error),
      {
        metadata: {
          action: 'clear',
          storage: 'sessionStorage',
        },
      }
    );
  });

  it('defaults unknown walletType values to external when hydrating', () => {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        account: wallet.account,
        chainId: null,
        walletType: 'something-else',
      })
    );

    const fresh = new WalletsService(productEvents);
    expect(fresh.lastConnected.value).toEqual(
      jasmine.objectContaining({
        account: wallet.account,
        walletType: 'external',
      })
    );
  });

  it('manages open and close request flags', () => {
    service.requestOpen();
    expect(service.openRequested.value).toBeTrue();
    service.clearOpenRequest();
    expect(service.openRequested.value).toBeFalse();

    service.requestClose();
    expect(service.closeRequested.value).toBeTrue();
    service.clearCloseRequest();
    expect(service.closeRequested.value).toBeFalse();
  });
});
