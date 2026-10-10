import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { BehaviorSubject, NEVER, of, throwError } from 'rxjs';
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

  for (const failure of ['error', 'timeout'] as const) {
    it(`retains recovery rows and the cursor after a refresh ${failure}, then replaces them on success`, fakeAsync(() => {
      const item = {
        preparationId: 'pending-reference',
        status: 'SUBMITTED' as const,
      };
      const getHistory = jasmine
        .createSpy('getHistory')
        .and.returnValues(
          of({ data: { items: [item], nextCursor: 'older-page' } }),
          failure === 'timeout'
            ? NEVER
            : throwError(() => new Error('offline')),
          of({ data: { items: [], nextCursor: null } })
        );
      TestBed.configureTestingModule({
        providers: [
          SwapHistoryFacade,
          {
            provide: AuthSessionService,
            useValue: { session$: of(sessionFor('alice')) },
          },
          {
            provide: SwapApiClient,
            useValue: { getHistory, getSwapStatus: () => of('PROCESSING') },
          },
        ],
      });
      const facade = TestBed.inject(SwapHistoryFacade);
      const states: SwapHistoryState[] = [];
      const subscription = facade.state$.subscribe(state => states.push(state));
      tick(0);
      const loaded = states.at(-1);
      expect(loaded?.items[0].status).toBe('PROCESSING');
      tick(15_000 + (failure === 'timeout' ? 10_000 : 0));
      expect(states.at(-1)?.items).toEqual(loaded?.items);
      expect(states.at(-1)?.nextCursor).toBe('older-page');
      expect(states.at(-1)?.error).toContain('Could not load');
      expect(states.at(-1)?.loading).toBeFalse();
      facade.retry();
      expect(states.at(-1)?.items).toEqual([]);
      expect(states.at(-1)?.nextCursor).toBeNull();
      expect(states.at(-1)?.error).toBe('');
      subscription.unsubscribe();
    }));
  }

  it('never retains another session’s rows after a failed refresh', fakeAsync(() => {
    const session$ = new BehaviorSubject<AuthSession | null>(
      sessionFor('alice')
    );
    const getHistory = jasmine.createSpy('getHistory').and.returnValues(
      of({
        data: {
          items: [{ preparationId: 'alice-swap', status: 'SUCCESS' }],
          nextCursor: null,
        },
      }),
      throwError(() => new Error('offline')),
      throwError(() => new Error('offline'))
    );
    TestBed.configureTestingModule({
      providers: [
        SwapHistoryFacade,
        { provide: AuthSessionService, useValue: { session$ } },
        { provide: SwapApiClient, useValue: { getHistory } },
      ],
    });
    const states: SwapHistoryState[] = [];
    const subscription = TestBed.inject(SwapHistoryFacade).state$.subscribe(
      state => states.push(state)
    );
    tick(0);
    tick(15_000);
    expect(states.at(-1)?.items[0].preparationId).toBe('alice-swap');
    session$.next(sessionFor('bob'));
    expect(states.at(-1)?.items).toEqual([]);
    tick(0);
    expect(states.at(-1)?.error).toContain('Could not load');
    expect(states.at(-1)?.items).toEqual([]);
    session$.next(null);
    expect(states.at(-1)?.items).toEqual([]);
    expect(states.at(-1)?.error).toBe('');
    expect(states.at(-1)?.signedIn).toBeFalse();
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
