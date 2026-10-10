import { parseSwapHistory } from './swap-history.parser';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, map, switchMap, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import type { ApiResponseEnvelope } from '@mfe-contracts/api-envelope';
import type {
  ApprovedSwapPreparePackage,
  SwapPrepareRequest,
  SwapQuotePreview,
  SwapQuoteRequest,
} from '@domains/exchange/models/swap.models';
import type {
  DefuseWalletSignatureResult,
  IntentRelayUserInfo,
} from '@mfe-contracts/wallet-execution.types';
import type { SwapExecutionMode } from '@mfe-contracts/intent-prepare.contract';
import type { SwapStatus } from '@mfe-contracts/swap-review.types';
import { mapQuotePreviewResponse } from './swap-api.mappers';
import { parseApprovedSwapPrepareResponse } from './swap-prepare-response.parser';

type SubmitIntentRequestBody = {
  providerId: string;
  executionMode?: SwapExecutionMode;
  executionPayload?: Record<string, unknown>;
  signature: DefuseWalletSignatureResult;
  quoteHashes: string[];
  userAddress: string;
  userChainType: IntentRelayUserInfo['userChainType'];
  traceId: string;
};

type SubmitIntentResponse = ApiResponseEnvelope<{ intentHash: string }>;

@Injectable({
  providedIn: 'root',
})
export class SwapApiClient {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly authProvider: AuthProviderService
  ) {}

  getHistory(cursor: string) {
    return from(this.authProvider.getAccessToken()).pipe(
      switchMap(token => {
        if (!token) throw new Error('No active session');
        return this.httpClient.get<unknown>(
          `${environment.apiUrl}/api/v1/swaps/history`,
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
            params: cursor ? { before: cursor } : {},
          }
        );
      }),
      map(parseSwapHistory)
    );
  }

  getSpendable(input: {
    sourceAssetId: string;
    originAsset: string;
    signerId: string;
    network: string;
    authMethod: 'near' | 'evm' | 'ton';
  }): Observable<string> {
    return from(this.authProvider.getAccessToken()).pipe(
      switchMap(token => {
        if (!token) throw new Error('No active session');
        return this.httpClient.post<{
          data: { amount: string; sourceAssetId: string; network: string };
        }>(`${environment.apiUrl}/api/v1/swaps/spendable`, input, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
        });
      }),
      map(response => {
        if (
          response.data.sourceAssetId !== input.sourceAssetId ||
          response.data.network !== input.network ||
          !/^\d+$/.test(response.data.amount)
        )
          throw new Error('Invalid spendable balance');
        return response.data.amount;
      })
    );
  }

  getPolicy(): Observable<number> {
    return this.httpClient
      .get<{
        data: { maxSlippageBps: number };
      }>(`${environment.apiUrl}/api/v1/swaps/policy`)
      .pipe(
        map(response => {
          const value = response.data.maxSlippageBps;
          if (!Number.isInteger(value) || value < 1 || value > 10_000)
            throw new Error('Invalid swap policy');
          return value;
        })
      );
  }

  requestIndicativePreview(
    input: import('@mfe-contracts/swap-review.types').WalletSwapInput
  ): Observable<SwapQuotePreview> {
    return this.httpClient
      .post<ApiResponseEnvelope<unknown>>(
        `${environment.apiUrl}/api/v1/quotes/preview`,
        {
          originAsset: input.source.executionAssetId,
          destinationAsset: input.destination.executionAssetId,
          amount: input.amount,
          swapType: input.swapType ?? 'EXACT_INPUT',
          slippageTolerance: input.slippageToleranceBps,
        }
      )
      .pipe(map(mapQuotePreviewResponse));
  }

  requestQuotePreview(request: SwapQuoteRequest): Observable<SwapQuotePreview> {
    return this.httpClient
      .post<
        ApiResponseEnvelope<unknown>
      >(`${environment.apiUrl}/api/v1/quotes/one-click`, this.toQuoteBody(request), { headers: this.traceHeaders(request.traceId) })
      .pipe(map(mapQuotePreviewResponse));
  }

  requestApprovedPreparePackage(
    request: SwapPrepareRequest
  ): Observable<ApprovedSwapPreparePackage> {
    return from(this.authProvider.whenSettled()).pipe(
      switchMap(() => this.authProvider.getAccessToken()),
      switchMap(token => {
        if (!token) {
          throw new Error(
            'Sign in and link this wallet before preparing a swap'
          );
        }
        return this.httpClient.post<ApiResponseEnvelope<unknown>>(
          `${environment.apiUrl}/api/v1/swaps/prepare`,
          this.toPrepareBody(request),
          {
            headers: this.traceHeaders(request.traceId).set(
              'Authorization',
              `Bearer ${token}`
            ),
          }
        );
      }),
      map(parseApprovedSwapPrepareResponse)
    );
  }

  submitSignedIntent(input: {
    providerId: string;
    executionMode?: SwapExecutionMode;
    executionPayload?: Record<string, unknown>;
    signature: DefuseWalletSignatureResult;
    quoteHashes: string[];
    user: IntentRelayUserInfo;
    traceId: string;
  }): Observable<string> {
    const body: SubmitIntentRequestBody = {
      providerId: input.providerId,
      executionMode: input.executionMode,
      executionPayload: {
        ...input.executionPayload,
        signature: input.signature,
        quoteHashes: input.quoteHashes,
      },
      signature: input.signature,
      quoteHashes: input.quoteHashes,
      userAddress: input.user.userAddress,
      userChainType: input.user.userChainType,
      traceId: input.traceId,
    };

    return from(this.authProvider.whenSettled()).pipe(
      switchMap(() => this.authProvider.getAccessToken()),
      switchMap(token => {
        if (!token) {
          throw new Error('No active session');
        }

        const idempotencyKey = this.executionIdempotencyKey(
          input.executionPayload
        );
        if (!idempotencyKey) {
          throw new Error(
            'Swap execution package is missing a valid preparationId'
          );
        }

        return this.httpClient.post<SubmitIntentResponse>(
          `${environment.apiUrl}/api/v1/swaps/execute`,
          body,
          {
            headers: this.traceHeaders(input.traceId)
              .set('Authorization', `Bearer ${token}`)
              .set('Idempotency-Key', idempotencyKey),
          }
        );
      }),
      map(response => {
        if (response.error || !response.data?.intentHash) {
          throw (
            response.error ?? {
              code: 'SUBMIT_FAILED',
              message: 'Swap execute response missing intentHash',
              retryable: false,
            }
          );
        }

        return response.data.intentHash;
      })
    );
  }

  getSwapStatus(
    preparationId: string,
    traceId: string
  ): Observable<SwapStatus> {
    if (!/^[0-9a-f-]{36}$/i.test(preparationId)) {
      throw new Error('Swap status requires a valid preparationId');
    }
    return from(this.authProvider.whenSettled()).pipe(
      switchMap(() => this.authProvider.getAccessToken()),
      switchMap(token => {
        if (!token) throw new Error('No active session');
        return this.httpClient.get<ApiResponseEnvelope<{ status: SwapStatus }>>(
          `${environment.apiUrl}/api/v1/swaps/status/${preparationId}`,
          {
            headers: this.traceHeaders(traceId).set(
              'Authorization',
              `Bearer ${token}`
            ),
          }
        );
      }),
      map(response => {
        if (response.error || !response.data?.status) {
          throw (
            response.error ??
            new Error('Swap status response is missing status')
          );
        }
        return response.data.status;
      })
    );
  }

  startSwapAttempt(
    preparationId: string,
    state: 'AWAITING_APPROVAL' | 'SUBMITTED' | 'CANCELLED' = 'AWAITING_APPROVAL'
  ): Observable<unknown> {
    return from(this.authProvider.getAccessToken()).pipe(
      switchMap(token => {
        if (!token) throw new Error('No active session');
        return this.httpClient.post(
          `${environment.apiUrl}/api/v1/swaps/${encodeURIComponent(preparationId)}/attempt`,
          { state },
          { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
        );
      }),
      timeout(10_000)
    );
  }

  private toQuoteBody(request: SwapQuoteRequest): Record<string, unknown> {
    return {
      dry: request.dry,
      slippageTolerance: request.slippageTolerance,
      originAsset: request.originAsset,
      destinationAsset: request.destinationAsset,
      amount: request.amount,
      deadline: request.deadline,
      userAddress:
        request.authMethod === 'evm'
          ? request.signerId.toLowerCase()
          : request.signerId,
      recipient: request.recipient,
      recipientType: request.recipientType,
      depositType: request.depositType,
      refundType: request.refundType,
      authMethod: request.authMethod,
      swapType: request.swapType ?? 'EXACT_INPUT',
      isConfidential: request.depositType === 'CONFIDENTIAL_INTENTS',
      isAuthenticated: true,
    };
  }

  private toPrepareBody(request: SwapPrepareRequest): Record<string, unknown> {
    return {
      providerId: request.providerId,
      sourceAssetId: request.sourceAssetId,
      network: request.network,
      originAsset: request.originAsset,
      destinationAsset: request.destinationAsset,
      amount: request.amount,
      deadline: request.deadline,
      signerId:
        request.authMethod === 'evm'
          ? request.signerId.toLowerCase()
          : request.signerId,
      recipient: request.recipient,
      recipientType: request.recipientType,
      depositType: request.depositType,
      refundType: request.refundType,
      authMethod: request.authMethod,
      slippageTolerance: request.slippageTolerance,
      swapType: request.swapType ?? 'EXACT_INPUT',
    };
  }

  private traceHeaders(traceId: string): HttpHeaders {
    return new HttpHeaders({
      'x-trace-id': traceId,
      'x-request-id': traceId,
    });
  }

  private executionIdempotencyKey(
    executionPayload?: Record<string, unknown>
  ): string | undefined {
    const preparationId = executionPayload?.['preparationId'];
    return typeof preparationId === 'string' &&
      /^[A-Za-z0-9._:-]{8,128}$/.test(preparationId)
      ? preparationId
      : undefined;
  }
}
