import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  DefuseWalletSignatureResult,
  IntentRelaySubmitInput,
} from '@mfe-contracts/wallet-execution.types';
import { SwapApiClient } from './swap-api.client';
import { createTraceId } from '@core/trace/create-trace-id';

/**
 * Host relay step for Path B.
 * `prepareBroadcastRequest.prepareSwapSignedData` runs in the NestJS BFF execute endpoint
 * so the Angular bundle does not pull Node-only Defuse SDK dependencies.
 */
@Injectable({
  providedIn: 'root',
})
export class IntentRelayService {
  constructor(private readonly swapApiClient: SwapApiClient) {}

  submitIntent(input: {
    traceId?: string;
    providerId: string;
    executionMode?: IntentRelaySubmitInput['executionMode'];
    executionPayload?: IntentRelaySubmitInput['executionPayload'];
    signature: DefuseWalletSignatureResult;
    quoteHashes: string[];
    user: IntentRelaySubmitInput['user'];
  }): Promise<string> {
    return firstValueFrom(
      this.swapApiClient.submitSignedIntent({
        providerId: input.providerId,
        executionMode: input.executionMode,
        executionPayload: input.executionPayload,
        signature: input.signature,
        quoteHashes: input.quoteHashes,
        user: input.user,
        traceId: input.traceId ?? createTraceId(),
      })
    );
  }
}
