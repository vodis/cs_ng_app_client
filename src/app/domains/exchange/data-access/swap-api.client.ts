import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
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
import {
  mapApprovedPreparePackage,
  mapQuotePreviewResponse,
} from './swap-api.mappers';

type SubmitIntentRequestBody = {
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
  constructor(private readonly httpClient: HttpClient) {}

  requestQuotePreview(request: SwapQuoteRequest): Observable<SwapQuotePreview> {
    return this.httpClient
      .post<
        ApiResponseEnvelope<unknown>
      >(`${environment.apiUrl}/api/v1/quotes/one-click`, this.toOneClickBody(request), { headers: this.traceHeaders(request.traceId) })
      .pipe(map(mapQuotePreviewResponse));
  }

  requestApprovedPreparePackage(
    request: SwapPrepareRequest
  ): Observable<ApprovedSwapPreparePackage> {
    return this.httpClient
      .post<
        ApiResponseEnvelope<unknown>
      >(`${environment.apiUrl}/api/v1/swaps/prepare`, this.toOneClickBody({ ...request, dry: false }), { headers: this.traceHeaders(request.traceId) })
      .pipe(map(mapApprovedPreparePackage));
  }

  submitSignedIntent(input: {
    signature: DefuseWalletSignatureResult;
    quoteHashes: string[];
    user: IntentRelayUserInfo;
    traceId: string;
  }): Observable<string> {
    const body: SubmitIntentRequestBody = {
      signature: input.signature,
      quoteHashes: input.quoteHashes,
      userAddress: input.user.userAddress,
      userChainType: input.user.userChainType,
      traceId: input.traceId,
    };

    return this.httpClient
      .post<SubmitIntentResponse>(
        `${environment.apiUrl}/api/v1/swaps/execute`,
        body,
        { headers: this.traceHeaders(input.traceId) }
      )
      .pipe(
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

  private toOneClickBody(
    request: SwapQuoteRequest & { traceId?: string }
  ): Record<string, unknown> {
    return {
      dry: request.dry,
      slippageTolerance: request.slippageTolerance,
      originAsset: request.originAsset,
      destinationAsset: request.destinationAsset,
      amount: request.amount,
      deadline: request.deadline,
      userAddress: request.userAddress.toLowerCase(),
      authMethod: request.authMethod,
      swapType: 'EXACT_INPUT',
      isConfidential: false,
      isAuthenticated: true,
    };
  }

  private traceHeaders(traceId: string): HttpHeaders {
    return new HttpHeaders({
      'x-trace-id': traceId,
      'x-request-id': traceId,
    });
  }
}
