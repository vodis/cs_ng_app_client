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
import { SwapExecutionWorkflow } from './swap-execution.workflow';

export type SwapFormInput = {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  signerId: string;
  recipient: string;
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS';
  slippageTolerance: number;
  deadline: string;
  authMethod: 'evm' | 'near';
};

type SwapExecutionWorkflowPort = Pick<
  SwapExecutionWorkflow,
  'requestQuotePreview' | 'requestQuotePreviewStream' | 'executeSwap'
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
    @Inject(SwapExecutionWorkflow)
    private readonly workflow: SwapExecutionWorkflowPort
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

  async executeSwap(input: SwapFormInput): Promise<void> {
    this.activeTraceId = createTraceId();
    const currentQuotePreview = this.quotePreview;
    this.quoteInputSubject.next(undefined);
    this.quotePreviewSubject.next(currentQuotePreview);
    this.errorSubject.next(undefined);
    this.intentHashSubject.next(undefined);
    this.setState('validating');

    try {
      const result = await this.workflow.executeSwap(input, this.activeTraceId);
      this.quotePreviewSubject.next({
        amountOut: this.quotePreview?.amountOut ?? '',
        raw: this.quotePreview?.raw ?? {},
      });
      this.intentHashSubject.next(result.intentHash);
      this.setState('completed');
    } catch (error) {
      this.handleFailure(this.stateSubject.value, error);
    }
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
    const requestVersion = ++this.quoteRequestVersion;
    this.errorSubject.next(undefined);
    this.intentHashSubject.next(undefined);
    this.quotePreviewSubject.next(undefined);

    if (!input) {
      this.setState('idle');
      return EMPTY;
    }

    return timer(this.quoteDebounceMs, this.quoteRefreshMs).pipe(
      switchMap(() => {
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
      input.originAsset,
      input.destinationAsset,
      input.amount,
      input.signerId.toLowerCase(),
      input.recipient.toLowerCase(),
      input.recipientType,
      input.slippageTolerance,
      input.authMethod,
    ].join('|');
  }

  private setState(state: SwapFlowState): void {
    this.stateSubject.next(state);
  }

  private handleFailure(step: SwapFlowState, error: unknown): void {
    this.errorSubject.next(this.toFlowError(step, error));
    this.setState('failed');
  }

  private toFlowError(step: SwapFlowState, error: unknown): SwapFlowError {
    return toSwapFlowError(step, error, 'Swap flow failed unexpectedly');
  }
}
