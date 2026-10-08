import { Injectable } from '@angular/core';
import type {
  SwapReviewPrepareRequest,
  SwapReviewPrepareResult,
} from '@mfe-contracts/swap-review.types';
import type {
  ApprovedSwapPreparePackage,
  SwapPrepareRequest,
} from '@domains/exchange/models/swap.models';
import { SwapApiClient } from '@domains/exchange/data-access/swap-api.client';

export type ExecutableQuoteHandle = {
  cancel: () => void;
};

type QuoteIdentity = {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  signerId: string;
  recipient: string;
  recipientType: SwapPrepareRequest['recipientType'];
  depositType: 'ORIGIN_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  refundType: 'ORIGIN_CHAIN' | 'INTENTS' | 'CONFIDENTIAL_INTENTS';
  authMethod: 'evm' | 'near' | 'ton';
  slippageTolerance: number;
  traceId: string;
};

type ActiveExecutableQuote = {
  key: string;
  controller: AbortController;
  promise: Promise<SwapReviewPrepareResult>;
  consumed: boolean;
};

/**
 * Starts the executable (dry: false) preparation when Review is clicked, then
 * lets the wallet dialog adopt that same request instead of preparing twice.
 * A failed balance check cancels the preparation before the dialog opens.
 */
@Injectable({
  providedIn: 'root',
})
export class SwapExecutableQuoteCoordinator {
  private active?: ActiveExecutableQuote;

  constructor(private readonly swapApi: SwapApiClient) {}

  start(request: SwapPrepareRequest): ExecutableQuoteHandle {
    this.cancel();
    const controller = new AbortController();
    const promise = this.execute(request, controller.signal);
    const active: ActiveExecutableQuote = {
      key: executableQuoteKey(request),
      controller,
      promise,
      consumed: false,
    };
    this.active = active;
    promise.catch(() => undefined);

    return {
      cancel: () => {
        if (this.active === active) {
          this.cancel();
        }
      },
    };
  }

  prepare(
    request: SwapReviewPrepareRequest,
    signal: AbortSignal
  ): Promise<SwapReviewPrepareResult> {
    return this.claim(request, signal) ?? this.execute(request, signal);
  }

  private claim(
    request: SwapReviewPrepareRequest,
    signal: AbortSignal
  ): Promise<SwapReviewPrepareResult> | undefined {
    const active = this.active;
    if (
      !active ||
      active.consumed ||
      active.key !== executableQuoteKey(request)
    ) {
      return undefined;
    }

    active.consumed = true;
    if (signal.aborted) {
      active.controller.abort();
    } else {
      signal.addEventListener(
        'abort',
        () => {
          active.controller.abort();
        },
        { once: true }
      );
    }
    return active.promise;
  }

  private cancel(): void {
    const active = this.active;
    if (!active) {
      return;
    }
    this.active = undefined;
    active.controller.abort();
  }

  private execute(
    request: QuoteIdentity,
    signal: AbortSignal
  ): Promise<SwapReviewPrepareResult> {
    if (signal.aborted) {
      return Promise.reject(cancelledPreparation());
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const resolveOnce = (result: SwapReviewPrepareResult) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };
      const rejectOnce = (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      const subscription = this.swapApi
        .requestApprovedPreparePackage(toPrepareRequest(request))
        .subscribe({
          next: result => {
            try {
              resolveOnce(toReviewResult(request, result));
            } catch (error) {
              rejectOnce(error);
            }
          },
          error: error => rejectOnce(error),
        });

      signal.addEventListener(
        'abort',
        () => {
          subscription.unsubscribe();
          rejectOnce(cancelledPreparation());
        },
        { once: true }
      );
    });
  }
}

function cancelledPreparation(): DOMException {
  return new DOMException('Swap preparation cancelled', 'AbortError');
}

function toPrepareRequest(request: QuoteIdentity): SwapPrepareRequest {
  return {
    providerId: 'one-click',
    traceId: request.traceId,
    originAsset: request.originAsset,
    destinationAsset: request.destinationAsset,
    amount: request.amount,
    signerId: request.signerId,
    recipient: request.recipient,
    recipientType: request.recipientType,
    depositType: request.depositType,
    refundType: request.refundType,
    authMethod: request.authMethod,
    slippageTolerance: request.slippageTolerance,
    deadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

function toReviewResult(
  request: QuoteIdentity,
  result: ApprovedSwapPreparePackage
): SwapReviewPrepareResult {
  const expectedMode =
    request.depositType === 'ORIGIN_CHAIN' ? 'deposit_address' : 'intent_sign';
  if (result.executionPackage.mode !== expectedMode) {
    throw new Error(
      `Execution mode ${result.executionPackage.mode} does not match the requested funding source.`
    );
  }

  return {
    prepareRequest: result,
    providerId: result.providerId,
    executionMode: result.executionPackage.mode,
    amountIn: result.amountIn,
    amountOut: result.amountOut,
    quoteExpiration: result.quoteExpiration,
  };
}

function executableQuoteKey(request: QuoteIdentity): string {
  return JSON.stringify([
    request.originAsset,
    request.destinationAsset,
    request.amount,
    request.signerId.toLowerCase(),
    request.recipient,
    request.recipientType,
    request.depositType,
    request.refundType,
    request.authMethod,
    request.slippageTolerance,
  ]);
}
