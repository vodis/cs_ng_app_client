import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  scan,
  shareReplay,
  startWith,
  timeout,
  switchMap,
  timer,
} from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { SwapApiClient } from '../data-access/swap-api.client';
import type { SwapHistoryItem } from '../models/swap-history.models';
export type { SwapHistoryItem } from '../models/swap-history.models';

export type SwapHistoryState = {
  items: SwapHistoryItem[];
  nextCursor: string | null;
  error: string;
  signedIn: boolean;
  loading: boolean;
};

@Injectable()
export class SwapHistoryFacade {
  private readonly session = inject(AuthSessionService);
  private readonly api = inject(SwapApiClient);
  private readonly checkId = new BehaviorSubject('');
  private readonly cursor = new BehaviorSubject<string>('');
  private readonly refresh = new BehaviorSubject(0);
  private reconciliationOffset = 0;
  readonly state$ = this.session.session$.pipe(
    map(session =>
      session ? `${session.user.id}:${session.user.sessionId}` : ''
    ),
    distinctUntilChanged(),
    switchMap(identity => {
      this.cursor.next('');
      this.checkId.next('');
      this.reconciliationOffset = 0;
      if (!identity)
        return of<SwapHistoryState>({
          items: [],
          nextCursor: null,
          error: '',
          signedIn: false,
          loading: false,
        });
      return combineLatest([
        this.cursor,
        this.refresh,
        this.checkId,
        timer(0, 15_000),
      ]).pipe(
        switchMap(([cursor, , checkId]) =>
          this.api.getHistory(cursor).pipe(
            timeout(10_000),
            switchMap(response => {
              // Bound reconciliation traffic. Checking a status never starts another transfer.
              const candidates = response.data.items.filter(
                row =>
                  row.preparationId !== checkId &&
                  [
                    'UNKNOWN',
                    'AWAITING_APPROVAL',
                    'SUBMITTED',
                    'KNOWN_DEPOSIT_TX',
                    'PENDING_DEPOSIT',
                    'INCOMPLETE_DEPOSIT',
                    'PROCESSING',
                  ].includes(row.status)
              );
              const offset =
                this.reconciliationOffset % Math.max(1, candidates.length);
              const rotated = [
                ...candidates.slice(offset),
                ...candidates.slice(0, offset),
              ];
              const requested = response.data.items.find(
                row => row.preparationId === checkId
              );
              const pending = (
                requested ? [requested, ...rotated] : rotated
              ).slice(0, 5);
              this.reconciliationOffset += requested ? 4 : 5;
              const checks = pending.map(row =>
                this.api
                  .getSwapStatus(row.preparationId, row.preparationId)
                  .pipe(
                    timeout(10_000),
                    map(status => ({ id: row.preparationId, status })),
                    catchError(() =>
                      of({ id: row.preparationId, status: row.status })
                    )
                  )
              );
              return (checks.length ? forkJoin(checks) : of([])).pipe(
                map(results => ({
                  ...response.data,
                  items: response.data.items.map(row => ({
                    ...row,
                    status: ['SUCCESS', 'REFUNDED', 'FAILED'].includes(
                      row.status
                    )
                      ? row.status
                      : (results.find(result => result.id === row.preparationId)
                          ?.status ?? row.status),
                  })),
                  error: '',
                  signedIn: true,
                  loading: false,
                }))
              );
            }),
            catchError(() =>
              of<SwapHistoryState>({
                items: [],
                nextCursor: null,
                error:
                  'Could not load swap history. Retry to check your exchanges.',
                signedIn: true,
                loading: false,
              })
            )
          )
        ),
        // Retain recovery references on refresh failure, scoped to this session.
        scan((previous: SwapHistoryState, current: SwapHistoryState) =>
          current.error
            ? { ...previous, error: current.error, loading: false }
            : current
        ),
        startWith<SwapHistoryState>({
          items: [],
          nextCursor: null,
          error: '',
          signedIn: true,
          loading: true,
        })
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  check(id: string): void {
    this.checkId.next(id);
  }
  retry(): void {
    this.refresh.next(this.refresh.value + 1);
  }
  page(cursor: string): void {
    this.cursor.next(cursor);
  }
}
