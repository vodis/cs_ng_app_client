import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { SwapApiClient } from './swap-api.client';

describe('SwapApiClient recipient mapping', () => {
  let client: SwapApiClient;
  let httpMock: HttpTestingController;

  const request = {
    traceId: 'trace-1',
    originAsset: 'nep141:eth-usdc.omft.near',
    destinationAsset: 'nep141:sol-usdc.omft.near',
    amount: '1000000',
    signerId: '0x0000000000000000000000000000000000000001',
    recipient: 'BYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z',
    recipientType: 'DESTINATION_CHAIN' as const,
    slippageTolerance: 50,
    deadline: '2026-08-18T10:15:00.000Z',
    authMethod: 'evm' as const,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    client = TestBed.inject(SwapApiClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('keeps signer/refund and recipient separate for dry quotes', () => {
    client.requestQuotePreview({ ...request, dry: true }).subscribe();
    const pending = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/quotes/one-click`
    );
    expect(pending.request.body).toEqual(
      jasmine.objectContaining({
        userAddress: request.signerId,
        recipient: request.recipient,
        recipientType: request.recipientType,
      })
    );
    pending.flush({ data: { amountOut: '900000' }, error: null });
  });

  it('uses the swaps prepare DTO instead of the legacy quote DTO', () => {
    client.requestApprovedPreparePackage(request).subscribe();
    const pending = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/swaps/prepare`
    );
    expect(pending.request.body).toEqual(
      jasmine.objectContaining({
        signerId: request.signerId,
        recipient: request.recipient,
        recipientType: request.recipientType,
      })
    );
    expect(pending.request.body.userAddress).toBeUndefined();
    pending.flush({
      data: {
        protocol: 'near-intents',
        kind: 'swap',
        providerId: 'solver-relay',
        executionPackage: {
          providerId: 'solver-relay',
          mode: 'intent_sign',
          protocol: 'near-intents',
          requiredAction: 'sign',
          payload: {},
        },
        quoteHashes: ['quote-hash'],
        signerId: request.signerId,
        authMethod: 'evm',
        deadlineTimestamp: 1_800_000_000,
        tokenDeltas: [{ assetId: request.originAsset, amount: '-1000000' }],
      },
      error: null,
    });
  });
});
