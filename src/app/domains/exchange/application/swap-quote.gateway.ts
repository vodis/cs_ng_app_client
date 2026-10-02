import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { createTraceId } from '@core/trace/create-trace-id';
import type {
  WalletSwapInput,
  WalletSwapQuote,
} from '@mfe-contracts/swap-review.types';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';

/** Host owns refresh/cancellation; the MFE owns quote preparation and execution. */
@Injectable({ providedIn: 'root' })
export class SwapQuoteGateway {
  constructor(private readonly walletGateway: WalletGatewayBridgeService) {}

  requestQuotePreview(input: WalletSwapInput, traceId = createTraceId()) {
    return firstValueFrom(this.requestQuotePreviewStream(input, traceId));
  }

  requestQuotePreviewStream(
    input: WalletSwapInput,
    traceId = createTraceId()
  ): Observable<{ traceId: string; preview: WalletSwapQuote }> {
    return new Observable(subscriber => {
      const controller = new AbortController();
      this.walletGateway
        .requestSwapQuote(input, { traceId, signal: controller.signal })
        .then(preview => {
          subscriber.next({ traceId, preview });
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
      return () => controller.abort();
    });
  }
}
