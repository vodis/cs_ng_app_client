import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import type { SwapPrepareRequest } from '@domains/exchange/models/swap.models';
import type { SwapReviewPrepareRequest } from '@mfe-contracts/swap-review.types';
import { environment } from '../../../../environments/environment';
import { SwapExecutableQuoteCoordinator } from './swap-executable-quote.coordinator';

describe('SwapExecutableQuoteCoordinator', () => {
  let coordinator: SwapExecutableQuoteCoordinator;
  let httpMock: HttpTestingController;

  const request: SwapPrepareRequest = {
    traceId: 'trace-1',
    originAsset: 'nep141:wrap.near',
    destinationAsset: 'nep141:usdc.near',
    amount: '1000000000000000000000000',
    signerId: 'alice.near',
    recipient: 'alice.near',
    recipientType: 'DESTINATION_CHAIN',
    depositType: 'INTENTS',
    refundType: 'INTENTS',
    slippageTolerance: 50,
    deadline: '2026-08-18T10:15:00.000Z',
    authMethod: 'near',
    providerId: 'one-click',
  };

  beforeEach(() => {
    const authProvider = jasmine.createSpyObj<AuthProviderService>(
      'AuthProviderService',
      ['whenSettled', 'getAccessToken']
    );
    authProvider.whenSettled.and.resolveTo({
      status: 'ready',
      loginMethods: ['email'],
      passkeyLoginEnabled: false,
      passkeySignupEnabled: false,
      passkeyLinkEnabled: false,
      embeddedWalletEnabled: true,
    });
    authProvider.getAccessToken.and.resolveTo('privy-access-token');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: AuthProviderService, useValue: authProvider }],
    });
    coordinator = TestBed.inject(SwapExecutableQuoteCoordinator);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lets the review dialog adopt the executable quote started on Review', fakeAsync(() => {
    const pending = coordinator.start(request);
    flushMicrotasks();
    const first = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/swaps/prepare`
    );
    expect(first.request.body).toEqual(
      jasmine.objectContaining({
        providerId: 'one-click',
        originAsset: request.originAsset,
        amount: request.amount,
        signerId: 'alice.near',
      })
    );
    first.flush(prepareEnvelope('intent_sign'));

    let adoptedAmount = '';
    coordinator
      .prepare(reviewRequest(), new AbortController().signal)
      .then(result => {
        adoptedAmount = result.amountOut;
      });
    flushMicrotasks();

    httpMock.expectNone(`${environment.apiUrl}/api/v1/swaps/prepare`);
    expect(adoptedAmount).toBe('900000');
    expect(pending.cancel).toEqual(jasmine.any(Function));
  }));

  it('cancels the executable quote before it is prepared', fakeAsync(() => {
    const pending = coordinator.start(request);
    pending.cancel();
    flushMicrotasks();

    httpMock.expectNone(`${environment.apiUrl}/api/v1/swaps/prepare`);
    let rejected = false;
    coordinator
      .prepare(reviewRequest(), new AbortController().signal)
      .catch(() => {
        rejected = true;
      });
    flushMicrotasks();
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/swaps/prepare`)
      .flush(prepareEnvelope('intent_sign'));
    flushMicrotasks();
    expect(rejected).toBeFalse();
  }));

  it('rejects an executable quote whose funding mode does not match', fakeAsync(() => {
    let message = '';
    const handle = coordinator.start({
      ...request,
      depositType: 'ORIGIN_CHAIN',
      refundType: 'ORIGIN_CHAIN',
    });
    flushMicrotasks();
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/swaps/prepare`)
      .flush(prepareEnvelope('intent_sign'));

    coordinator
      .prepare(
        reviewRequest({
          depositType: 'ORIGIN_CHAIN',
          refundType: 'ORIGIN_CHAIN',
        }),
        new AbortController().signal
      )
      .catch(error => {
        message = error instanceof Error ? error.message : '';
      });
    flushMicrotasks();

    expect(message).toContain('does not match the requested funding source');
    handle.cancel();
  }));

  function reviewRequest(
    overrides: Partial<SwapReviewPrepareRequest> = {}
  ): SwapReviewPrepareRequest {
    return {
      providerId: 'one-click',
      dry: false,
      traceId: request.traceId,
      originAsset: request.originAsset,
      destinationAsset: request.destinationAsset,
      amount: request.amount,
      signerId: 'Alice.near',
      recipient: request.recipient,
      recipientType: request.recipientType,
      depositType: request.depositType,
      refundType: request.refundType,
      authMethod: request.authMethod,
      slippageTolerance: request.slippageTolerance,
      deadline: request.deadline,
      ...overrides,
    };
  }

  function prepareEnvelope(mode: 'intent_sign' | 'deposit_address') {
    return {
      data: {
        protocol: 'near-intents',
        kind: 'swap',
        providerId: 'one-click',
        executionPackage: {
          providerId: 'one-click',
          mode,
          protocol: 'near-intents',
          requiredAction: mode === 'deposit_address' ? 'deposit' : 'sign',
          payload:
            mode === 'deposit_address'
              ? { depositAddress: 'deposit.near' }
              : { preparationId: '22222222-2222-4222-8222-222222222222' },
        },
        quoteHashes: ['quote-hash'],
        signerId: request.signerId,
        authMethod: 'near',
        deadlineTimestamp: 1_800_000_000,
        amountIn: request.amount,
        amountOut: '900000',
        quoteExpiration: '2099-01-01T00:00:00.000Z',
        slippageTolerance: 50,
        tokenDeltas: [
          { assetId: request.originAsset, amount: `-${request.amount}` },
        ],
      },
      error: null,
    };
  }
});
