import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import { SwapApiClient } from './swap-api.client';

describe('SwapApiClient', () => {
  let client: SwapApiClient;
  let httpMock: HttpTestingController;
  let authProvider: jasmine.SpyObj<AuthProviderService>;

  const request = {
    traceId: 'trace-1',
    originAsset: 'nep141:eth-usdc.omft.near',
    destinationAsset: 'nep141:sol-usdc.omft.near',
    amount: '1000000',
    signerId: '0x0000000000000000000000000000000000000001',
    recipient: 'BYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z',
    recipientType: 'DESTINATION_CHAIN' as const,
    depositType: 'ORIGIN_CHAIN' as const,
    refundType: 'ORIGIN_CHAIN' as const,
    slippageTolerance: 50,
    deadline: '2026-08-18T10:15:00.000Z',
    authMethod: 'evm' as const,
  };
  const executionRequest = {
    providerId: 'one-click',
    executionMode: 'intent_sign' as const,
    executionPayload: {
      preparationId: '22222222-2222-4222-8222-222222222222',
      generatedIntent: { deadline: '2099-01-01T00:00:00.000Z' },
    },
    signature: { signature: 'signed-intent' },
    quoteHashes: ['quote-hash'],
    user: {
      userAddress: request.signerId,
      userChainType: 'evm' as const,
    },
    traceId: 'trace-execution-1',
  };

  beforeEach(() => {
    authProvider = jasmine.createSpyObj<AuthProviderService>(
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
        depositType: request.depositType,
        refundType: request.refundType,
      })
    );
    pending.flush({ data: { amountOut: '900000' }, error: null });
  });

  it('passes confidential balance custody through preview and prepare', () => {
    const confidential = {
      ...request,
      depositType: 'CONFIDENTIAL_INTENTS' as const,
      refundType: 'CONFIDENTIAL_INTENTS' as const,
    };
    client.requestQuotePreview({ ...confidential, dry: true }).subscribe();
    const preview = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/quotes/one-click`
    );
    expect(preview.request.body).toEqual(
      jasmine.objectContaining({
        depositType: 'CONFIDENTIAL_INTENTS',
        refundType: 'CONFIDENTIAL_INTENTS',
        isConfidential: true,
      })
    );
    preview.flush({ data: { amountOut: '900000' }, error: null });
  });

  it('uses an authenticated swaps prepare DTO before the wallet signs', fakeAsync(() => {
    client
      .requestApprovedPreparePackage({ ...request, providerId: 'one-click' })
      .subscribe();
    flushMicrotasks();
    const pending = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/swaps/prepare`
    );
    expect(pending.request.headers.get('Authorization')).toBe(
      'Bearer privy-access-token'
    );
    expect(pending.request.body).toEqual(
      jasmine.objectContaining({
        signerId: request.signerId,
        providerId: 'one-click',
        recipient: request.recipient,
        recipientType: request.recipientType,
        depositType: request.depositType,
        refundType: request.refundType,
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
        amountIn: '1000000',
        amountOut: '900000',
        quoteExpiration: '2099-01-01T00:00:00.000Z',
        slippageTolerance: 50,
        tokenDeltas: [{ assetId: request.originAsset, amount: '-1000000' }],
      },
      error: null,
    });
  }));

  it('does not prepare a swap without an authenticated session', fakeAsync(() => {
    authProvider.getAccessToken.and.resolveTo(null);
    let failure: unknown;
    client
      .requestApprovedPreparePackage({ ...request, providerId: 'one-click' })
      .subscribe({ error: error => (failure = error) });
    flushMicrotasks();
    expect(failure).toEqual(
      jasmine.objectContaining({
        message: 'Sign in and link this wallet before preparing a swap',
      })
    );
    httpMock.expectNone(`${environment.apiUrl}/api/v1/swaps/prepare`);
  }));

  it('authenticates execution and binds idempotency to the preparation', fakeAsync(() => {
    let intentHash: string | undefined;

    client
      .submitSignedIntent(executionRequest)
      .subscribe(value => (intentHash = value));

    flushMicrotasks();

    const pending = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/swaps/execute`
    );
    expect(pending.request.headers.get('Authorization')).toBe(
      'Bearer privy-access-token'
    );
    expect(pending.request.headers.get('Idempotency-Key')).toBe(
      '22222222-2222-4222-8222-222222222222'
    );
    expect(pending.request.headers.get('x-trace-id')).toBe('trace-execution-1');
    pending.flush({ data: { intentHash: 'intent-hash' }, error: null });

    expect(intentHash).toBe('intent-hash');
  }));

  it('preserves a typed pre-provider 403 for the wallet review', fakeAsync(() => {
    let failure: HttpErrorResponse | undefined;
    client.submitSignedIntent(executionRequest).subscribe({
      error: (error: HttpErrorResponse) => (failure = error),
    });
    flushMicrotasks();

    const pending = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/swaps/execute`
    );
    pending.flush(
      { code: 'SWAP_WALLET_NOT_AUTHORIZED' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(failure?.status).toBe(403);
    expect(failure?.error.code).toBe('SWAP_WALLET_NOT_AUTHORIZED');
  }));

  it('retrieves authenticated 1Click settlement status by preparation id', fakeAsync(() => {
    let status: string | undefined;
    const preparationId = '22222222-2222-4222-8222-222222222222';
    client
      .getSwapStatus(preparationId, request.traceId)
      .subscribe(value => (status = value));
    flushMicrotasks();
    const pending = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/swaps/status/${preparationId}`
    );
    expect(pending.request.headers.get('Authorization')).toBe(
      'Bearer privy-access-token'
    );
    expect(pending.request.headers.get('x-trace-id')).toBe(request.traceId);
    expect(pending.request.headers.get('x-request-id')).toBe(request.traceId);
    pending.flush({ data: { status: 'SUCCESS' }, error: null });
    expect(status).toBe('SUCCESS');
  }));

  it('fails execution before transport when no access token is available', fakeAsync(() => {
    authProvider.getAccessToken.and.resolveTo(null);
    let submissionError: Error | undefined;

    client
      .submitSignedIntent(executionRequest)
      .subscribe({ error: error => (submissionError = error) });

    flushMicrotasks();

    expect(submissionError?.message).toBe('No active session');
    httpMock.expectNone(`${environment.apiUrl}/api/v1/swaps/execute`);
  }));

  it('fails execution before transport without a valid preparation id', fakeAsync(() => {
    let submissionError: Error | undefined;

    client
      .submitSignedIntent({
        ...executionRequest,
        executionPayload: {},
      })
      .subscribe({ error: error => (submissionError = error) });

    flushMicrotasks();

    expect(submissionError?.message).toBe(
      'Swap execution package is missing a valid preparationId'
    );
    httpMock.expectNone(`${environment.apiUrl}/api/v1/swaps/execute`);
  }));
});
