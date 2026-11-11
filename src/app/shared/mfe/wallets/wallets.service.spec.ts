/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { ProductEventsService } from '@core/product-events/product-events.service';
import { LastConnectedWallet } from '@domains/wallet/models/wallet.models';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  let service: WalletsService;
  let productEvents: jasmine.SpyObj<ProductEventsService>;
  const legacyKey = 'cs-host.last-connected-wallet.v1';
  const keyFor = (userId: string) =>
    `cs-host.last-connected-wallet.v2:${userId}`;

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

  it('persists and restores the last connected wallet for a user', () => {
    service.rememberConnectedWallet(wallet, 'user-a');

    expect(service.lastConnected.value).toEqual({
      ...wallet,
      userId: 'user-a',
    });
    expect(
      JSON.parse(window.sessionStorage.getItem(keyFor('user-a')) ?? '{}')
    ).toEqual({ ...wallet, userId: 'user-a' });
  });

  it('does not hydrate another user from a shared legacy key', () => {
    window.sessionStorage.setItem(legacyKey, JSON.stringify(wallet));

    const fresh = new WalletsService(productEvents);
    fresh.hydrateLastConnectedForUser('user-b');

    expect(fresh.lastConnected.value).toBeUndefined();
    expect(window.sessionStorage.getItem(legacyKey)).toBeNull();
  });

  it('hydrates only the active user entry from sessionStorage', () => {
    window.sessionStorage.setItem(
      keyFor('user-a'),
      JSON.stringify({ ...wallet, userId: 'user-a' })
    );
    window.sessionStorage.setItem(
      keyFor('user-b'),
      JSON.stringify({
        ...wallet,
        account: '0xbbbb000000000000000000000000000000000bbb',
        userId: 'user-b',
      })
    );

    const fresh = new WalletsService(productEvents);
    fresh.hydrateLastConnectedForUser('user-b');

    expect(fresh.lastConnected.value).toEqual(
      jasmine.objectContaining({
        account: '0xbbbb000000000000000000000000000000000bbb',
        userId: 'user-b',
      })
    );
  });

  it('ignores invalid sessionStorage payloads when hydrating', () => {
    window.sessionStorage.setItem(keyFor('user-a'), '{not-json');
    const fresh = new WalletsService(productEvents);
    fresh.hydrateLastConnectedForUser('user-a');
    expect(fresh.lastConnected.value).toBeUndefined();
  });

  it('clears last connected wallet from memory and the user storage key', () => {
    service.rememberConnectedWallet(wallet, 'user-a');
    service.rememberConnectedWallet(
      { ...wallet, account: '0xbbbb000000000000000000000000000000000bbb' },
      'user-b'
    );
    service.clearLastConnectedWallet('user-a');

    expect(service.lastConnected.value).toBeUndefined();
    expect(window.sessionStorage.getItem(keyFor('user-a'))).toBeNull();
    expect(window.sessionStorage.getItem(keyFor('user-b'))).not.toBeNull();
  });

  it('does not expose user A remembered wallet after logout when user B signs in', () => {
    service.rememberConnectedWallet(wallet, 'user-a');
    service.clearLastConnectedWallet('user-a');
    service.hydrateLastConnectedForUser('user-b');

    expect(service.lastConnected.value).toBeUndefined();
    expect(window.sessionStorage.getItem(keyFor('user-a'))).toBeNull();
  });

  it('records a product event when persist fails', () => {
    spyOn(window.sessionStorage, 'setItem').and.throwError(
      'QuotaExceededError'
    );

    service.rememberConnectedWallet(wallet, 'user-a');

    expect(service.lastConnected.value).toEqual({
      ...wallet,
      userId: 'user-a',
    });
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
    service.rememberConnectedWallet(wallet, 'user-a');
    spyOn(window.sessionStorage, 'removeItem').and.throwError(
      'storage blocked'
    );

    service.clearLastConnectedWallet('user-a');

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
      keyFor('user-a'),
      JSON.stringify({
        account: wallet.account,
        chainId: null,
        walletType: 'something-else',
        userId: 'user-a',
      })
    );

    const fresh = new WalletsService(productEvents);
    fresh.hydrateLastConnectedForUser('user-a');
    expect(fresh.lastConnected.value).toEqual(
      jasmine.objectContaining({
        account: wallet.account,
        walletType: 'external',
        userId: 'user-a',
      })
    );
  });

  it('manages open and close request flags', () => {
    service.requestOpen('swap-review');
    expect(service.openRequested.value).toBeTrue();
    expect(service.drawerMode.value).toBe('swap-review');
    service.clearOpenRequest();
    expect(service.openRequested.value).toBeFalse();

    service.requestClose();
    expect(service.closeRequested.value).toBeTrue();
    service.clearCloseRequest();
    expect(service.closeRequested.value).toBeFalse();
  });
});
