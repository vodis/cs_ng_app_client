import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { createTraceId } from '@core/trace/create-trace-id';
import type {
  SwapFlowError,
  SwapFlowState,
  SwapQuotePreview,
} from '@domains/exchange/models/swap.models';
import { SwapExecutionWorkflow } from './swap-execution.workflow';

export type SwapFormInput = {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  userAddress: string;
  slippageTolerance: number;
  deadline: string;
  authMethod: 'evm' | 'near';
};

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
  private activeTraceId = createTraceId();
  private quoteRequestVersion = 0;

  readonly state$ = this.stateSubject.asObservable();
  readonly quotePreview$ = this.quotePreviewSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();
  readonly intentHash$ = this.intentHashSubject.asObservable();

  constructor(private readonly workflow: SwapExecutionWorkflow) {}

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

  async executeSwap(input: SwapFormInput): Promise<void> {
    this.activeTraceId = createTraceId();
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
    this.quotePreviewSubject.next(undefined);
    this.errorSubject.next(undefined);
    this.intentHashSubject.next(undefined);
    this.setState('idle');
  }

  private setState(state: SwapFlowState): void {
    this.stateSubject.next(state);
  }

  private handleFailure(step: SwapFlowState, error: unknown): void {
    this.errorSubject.next(this.toFlowError(step, error));
    this.setState('failed');
  }

  private toFlowError(step: SwapFlowState, error: unknown): SwapFlowError {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'retryable' in error
    ) {
      return { ...(error as SwapFlowError), step };
    }

    return {
      code: 'SWAP_FAILED',
      message:
        error instanceof Error
          ? error.message
          : 'Swap flow failed unexpectedly',
      retryable: true,
      step,
    };
  }
}
