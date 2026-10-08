import type { WalletSwapInput } from '@mfe-contracts/swap-review.types';
import { Inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  EMPTY,
  Subject,
  catchError,
  distinctUntilChanged,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { createTraceId } from '@core/trace/create-trace-id';
import type {
  SwapFlowError,
  SwapFlowState,
  SwapQuotePreview,
} from '@domains/exchange/models/swap.models';
import { toSwapFlowError } from '@domains/exchange/models/swap-flow-error';
import { SwapQuoteGateway } from './swap-quote.gateway';

export type SwapFormInput = WalletSwapInput;

type SwapQuoteGatewayPort = Pick<
  SwapQuoteGateway,
  'requestQuotePreview' | 'requestQuotePreviewStream'
>;

@Injectable({
  providedIn: 'root',
})
export class SwapFlowFacade {
  private readonly stateSubject = new BehaviorSubject<SwapFlowState>('idle');
  private readonly quotePreviewSubject = new BehaviorSubject<
    SwapQuotePreview | undefined
  >(undefined);
  private readonly errorSubject = new BehaviorSubject<
    SwapFlowError | undefined
  >(undefined);
  private readonly intentHashSubject = new BehaviorSubject<string | undefined>(
    undefined
  );
  private readonly quoteInputSubject = new Subject<SwapFormInput | undefined>();
  private readonly quoteDebounceMs = 350;
  private readonly quoteRefreshMs = 60_000;
  private activeTraceId = createTraceId();
  private quoteRequestVersion = 0;

  readonly state$ = this.stateSubject.asObservable();
  readonly quotePreview$ = this.quotePreviewSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();
  readonly intentHash$ = this.intentHashSubject.asObservable();

  constructor(
    @Inject(SwapQuoteGateway)
    private readonly workflow: SwapQuoteGatewayPort
  ) {
    this.quoteInputSubject
      .pipe(
        distinctUntilChanged(
          (previous, current) =>
            this.quoteInputKey(previous) === this.quoteInputKey(current)
        ),
        switchMap(input => this.watchQuoteInput(input))
      )
      .subscribe();
  }

  get state(): SwapFlowState {
    return this.stateSubject.value;
  }

  get quotePreview(): SwapQuotePreview | undefined {
    return this.quotePreviewSubject.value;
  }

  get error(): SwapFlowError | undefined {
    return this.errorSubject.value;
  }

  async requestQuotePreview(input: SwapFormInput): Promise<void> {
    this.activeTraceId = createTraceId();
    const requestVersion = ++this.quoteRequestVersion;
    this.errorSubject.next(undefined);
    this.intentHashSubject.next(undefined);
    this.setState('requestingQuote');

    try {
      const { preview } = await this.workflow.requestQuotePreview(
        input,
        this.activeTraceId
      );
      if (requestVersion !== this.quoteRequestVersion) {
        return;
      }
      this.quotePreviewSubject.next(preview);
      this.setState('idle');
    } catch (error) {
      if (requestVersion !== this.quoteRequestVersion) {
        return;
      }
      this.errorSubject.next(this.toFlowError('requestingQuote', error));
      this.setState('idle');
    }
  }

  watchQuotePreview(input: SwapFormInput | undefined): void {
    this.quoteInputSubject.next(input);
  }

  refreshQuotePreview(input: SwapFormInput): void {
    this.quoteInputSubject.next(undefined);
    this.quoteInputSubject.next(input);
  }

  reset(): void {
    this.activeTraceId = createTraceId();
    this.quoteRequestVersion++;
    this.quoteInputSubject.next(undefined);
    this.quotePreviewSubject.next(undefined);
    this.errorSubject.next(undefined);
    this.intentHashSubject.next(undefined);
    this.setState('idle');
  }

  private watchQuoteInput(input: SwapFormInput | undefined) {
    ++this.quoteRequestVersion;
    this.errorSubject.next(undefined);
    this.intentHashSubject.next(undefined);
    this.quotePreviewSubject.next(undefined);

    if (!input) {
      this.setState('idle');
      return EMPTY;
    }

    return timer(this.quoteDebounceMs, this.quoteRefreshMs).pipe(
      switchMap(() => {
        const requestVersion = ++this.quoteRequestVersion;
        const traceId = createTraceId();
        this.activeTraceId = traceId;
        this.setState('requestingQuote');

        return this.workflow.requestQuotePreviewStream(input, traceId).pipe(
          tap(({ preview }) => {
            if (requestVersion !== this.quoteRequestVersion) {
              return;
            }

            this.quotePreviewSubject.next(preview);
            this.setState('idle');
          }),
          catchError(error => {
            if (requestVersion === this.quoteRequestVersion) {
              this.errorSubject.next(
                this.toFlowError('requestingQuote', error)
              );
              this.setState('idle');
            }

            return EMPTY;
          })
        );
      })
    );
  }

  private quoteInputKey(input: SwapFormInput | undefined): string {
    if (!input) {
      return '';
    }

    return [
      input.source.assetId,
      input.source.executionAssetId,
      input.destination.assetId,
      input.destination.executionAssetId,
      input.amount,
      input.account,
      input.recipient,
      input.slippageToleranceBps,
      input.confidential,
      input.network.id,
    ].join('|');
  }

  private setState(state: SwapFlowState): void {
    this.stateSubject.next(state);
  }

  private toFlowError(step: SwapFlowState, error: unknown): SwapFlowError {
    return toSwapFlowError(step, error, 'Swap flow failed unexpectedly');
  }
}
