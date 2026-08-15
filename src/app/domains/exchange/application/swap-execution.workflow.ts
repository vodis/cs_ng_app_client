import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, map } from 'rxjs';
import { AppLoggerService } from '@core/logging/app-logger.service';
import { createTraceId } from '@core/trace/create-trace-id';
import type {
  ApprovedSwapPreparePackage,
  SwapFlowError,
  SwapFlowState,
  SwapPrepareRequest,
  SwapQuotePreview,
  SwapQuoteRequest,
} from '@domains/exchange/models/swap.models';
import { toSwapFlowError } from '@domains/exchange/models/swap-flow-error';
import { SwapApiClient } from '@domains/exchange/data-access/swap-api.client';
import { IntentRelayService } from '@domains/exchange/data-access/intent-relay.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { ProductEventsService } from '@core/product-events/product-events.service';

@Injectable({
  providedIn: 'root',
})
export class SwapExecutionWorkflow {
  constructor(
    private readonly swapApiClient: SwapApiClient,
    private readonly intentRelayService: IntentRelayService,
    private readonly walletGatewayBridge: WalletGatewayBridgeService,
    private readonly logger: AppLoggerService,
    private readonly productEvents: ProductEventsService
  ) {}

  async requestQuotePreview(
    request: Omit<SwapQuoteRequest, 'traceId' | 'dry'>,
    traceId = createTraceId()
  ): Promise<{ traceId: string; preview: SwapQuotePreview }> {
    const { preview } = await firstValueFrom(
      this.requestQuotePreviewStream(request, traceId)
    );

    return { traceId, preview };
  }

  requestQuotePreviewStream(
    request: Omit<SwapQuoteRequest, 'traceId' | 'dry'>,
    traceId = createTraceId()
  ): Observable<{ traceId: string; preview: SwapQuotePreview }> {
    return this.swapApiClient
      .requestQuotePreview({
        ...request,
        traceId,
        dry: true,
      })
      .pipe(map(preview => ({ traceId, preview })));
  }

  async executeSwap(
    request: Omit<SwapPrepareRequest, 'traceId'>,
    traceId = createTraceId()
  ): Promise<{
    traceId: string;
    preparePackage: ApprovedSwapPreparePackage;
    intentHash: string;
  }> {
    const startedAt = Date.now();
    let step: SwapFlowState = 'validating';
    this.productEvents.record({
      eventName: 'swap.confirmed',
      status: 'attempted',
      requestId: traceId,
      metadata: {
        authMethod: request.authMethod,
        originAsset: request.originAsset,
        destinationAsset: request.destinationAsset,
      },
    });

    try {
      this.logTransition(traceId, step, 'started');
      step = 'requestingQuote';
      this.logTransition(traceId, step, 'started');

      const preparePackage = await firstValueFrom(
        this.swapApiClient.requestApprovedPreparePackage({
          ...request,
          traceId,
        })
      );

      if (preparePackage.executionPackage.requiredAction !== 'sign') {
        throw {
          code: 'UNSUPPORTED_EXECUTION_ACTION',
          message: `Swap execution action ${preparePackage.executionPackage.requiredAction} is not supported yet`,
          retryable: false,
        };
      }

      step = 'awaitingUserSignature';
      this.logTransition(traceId, step, 'started');

      const signature = await this.walletGatewayBridge.runIntentSignFlow({
        traceId,
        prepareRequest: preparePackage,
      });

      step = 'submittingTransaction';
      this.logTransition(traceId, step, 'started');

      const intentHash = await this.intentRelayService.submitIntent({
        traceId,
        providerId: preparePackage.providerId,
        executionMode: preparePackage.executionPackage.mode,
        executionPayload: preparePackage.executionPackage.payload,
        signature,
        quoteHashes: preparePackage.quoteHashes,
        user: {
          userAddress: request.userAddress.toLowerCase(),
          userChainType: preparePackage.authMethod,
        },
      });

      step = 'completed';
      this.logTransition(traceId, step, 'success', Date.now() - startedAt, {
        intentHash,
      });
      this.productEvents.record({
        eventName: 'swap.confirmed',
        status: 'succeeded',
        requestId: traceId,
        metadata: {
          authMethod: request.authMethod,
          intentHash,
          durationMs: Date.now() - startedAt,
        },
      });

      return { traceId, preparePackage, intentHash };
    } catch (error) {
      this.logTransition(traceId, step, 'failed', Date.now() - startedAt, {
        error,
      });
      this.productEvents.recordFailure('swap.confirmed', error, {
        requestId: traceId,
        metadata: {
          authMethod: request.authMethod,
          step,
          durationMs: Date.now() - startedAt,
        },
      });
      throw this.toFlowError(step, error);
    }
  }

  private toFlowError(step: SwapFlowState, error: unknown): SwapFlowError {
    return toSwapFlowError(step, error, 'Swap execution failed unexpectedly');
  }

  private logTransition(
    traceId: string,
    step: SwapFlowState,
    result: 'started' | 'success' | 'failed',
    durationMs?: number,
    details?: Record<string, unknown>
  ): void {
    this.logger.log(
      result === 'failed' ? 'error' : 'info',
      'Swap workflow transition',
      {
        flowName: 'swap',
        traceId,
        step,
        result,
        durationMs,
        ...details,
      }
    );
  }
}
