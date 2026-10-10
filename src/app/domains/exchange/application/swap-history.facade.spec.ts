import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import type { AuthSession } from '@core/auth/auth-session.types';
import { SwapApiClient } from '../data-access/swap-api.client';
import { SwapHistoryFacade, SwapHistoryState } from './swap-history.facade';

describe('SwapHistoryFacade session isolation', () => {
  const sessionFor = (id: string): AuthSession => ({
    user: { id, providerUserId: id, sessionId: id },
    wallets: [],
  });
  it('clears previous rows immediately and cancels requests when the account changes or signs out', fakeAsync(() => {
    const session$ = new BehaviorSubject<AuthSession | null>(
      sessionFor('alice')
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SwapHistoryFacade,
        { provide: AuthSessionService, useValue: { session$ } },
        {
          provide: AuthProviderService,
          useValue: { getAccessToken: () => Promise.resolve('test-token') },
        },
        SwapApiClient,
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const states: SwapHistoryState[] = [];
    const subscription = TestBed.inject(SwapHistoryFacade).state$.subscribe(
      state => states.push(state)
    );
    tick(0);
    http
      .expectOne(req => req.url.endsWith('/swaps/history'))
      .flush({
        data: {
          items: [
            {
              preparationId: '11111111-1111-4111-8111-111111111111',
              createdAt: '2026-10-10T00:00:00Z',
              status: 'SUCCESS',
              sourceSymbol: 'NEAR',
              destinationSymbol: 'USDC',
              sourceDecimals: 24,
              destinationDecimals: 6,
              amountIn: '1',
              amountOut: '1',
              network: 'near:mainnet',
              destinationNetwork: 'near',
              recipient: 'alice.near',
            },
          ],
          nextCursor: null,
        },
      });
    expect(states.at(-1)?.items.length).toBe(1);
    session$.next(sessionFor('bob'));
    expect(states.at(-1)?.items).toEqual([]);
    expect(states.at(-1)?.loading).toBeTrue();
    tick(0);
    const pending = http.expectOne(req => req.url.endsWith('/swaps/history'));
    session$.next(null);
    expect(pending.cancelled).toBeTrue();
    expect(states.at(-1)?.signedIn).toBeFalse();
    expect(states.at(-1)?.items).toEqual([]);
    subscription.unsubscribe();
    http.verify();
  }));
  it('preserves a settled status when an explicit status check fails', fakeAsync(() => {
    const item = { preparationId: 'settled', status: 'SUCCESS' as const };
    const api = {
      getHistory: () => of({ data: { items: [item], nextCursor: null } }),
      getSwapStatus: () => throwError(() => new Error('offline')),
    };
    TestBed.configureTestingModule({
      providers: [
        SwapHistoryFacade,
        {
          provide: AuthSessionService,
          useValue: { session$: of(sessionFor('alice')) },
        },
        { provide: SwapApiClient, useValue: api },
      ],
    });
    const facade = TestBed.inject(SwapHistoryFacade);
    const states: SwapHistoryState[] = [];
    const subscription = facade.state$.subscribe(state => states.push(state));
    tick(0);
    facade.check('settled');
    expect(states.at(-1)?.items[0].status).toBe('SUCCESS');
    subscription.unsubscribe();
  }));

  it('rotates bounded checks so older pending swaps are not starved', fakeAsync(() => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      preparationId: String(index),
      status: 'SUBMITTED' as const,
    }));
    const check = jasmine.createSpy('check').and.returnValue(of('PROCESSING'));
    TestBed.configureTestingModule({
      providers: [
        SwapHistoryFacade,
        {
          provide: AuthSessionService,
          useValue: { session$: of(sessionFor('alice')) },
        },
        {
          provide: SwapApiClient,
          useValue: {
            getHistory: () => of({ data: { items, nextCursor: null } }),
            getSwapStatus: check,
          },
        },
      ],
    });
    const facade = TestBed.inject(SwapHistoryFacade);
    const subscription = facade.state$.subscribe();
    tick(0);
    expect(check).not.toHaveBeenCalledWith('5', '5');
    facade.check('0');
    tick(30_000);
    for (let index = 0; index < 10; index++) {
      expect(check).toHaveBeenCalledWith(String(index), String(index));
    }
    subscription.unsubscribe();
  }));
});
