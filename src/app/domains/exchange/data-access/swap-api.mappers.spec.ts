import type { ApiResponseEnvelope } from '@mfe-contracts/api-envelope';
import {
  mapApprovedPreparePackage,
  mapQuotePreviewResponse,
} from './swap-api.mappers';

describe('swap-api mappers', () => {
  it('maps backend amountOut into the quote preview', () => {
    const preview = mapQuotePreviewResponse({
      data: {
        amountOut: '123456789',
        destinationAmount: 'stale-fallback',
      },
      error: null,
      meta: { traceId: 'trace' },
    });

    expect(preview.amountOut).toBe('123456789');
    expect(preview.raw['amountOut']).toBe('123456789');
  });

  it('maps nested 1Click quote amountOut into the quote preview', () => {
    const preview = mapQuotePreviewResponse({
      data: {
        quote: {
          amountOut: '987654321',
        },
      },
      error: null,
    });

    expect(preview.amountOut).toBe('987654321');
  });

  it('maps nested one-click quote response using backend formatted output', () => {
    const envelope: ApiResponseEnvelope<unknown> = {
      data: {
        quote: {
          amountOut: '450318543814579873646208',
          amountOutFormatted: '0.450318543814579873646208',
        },
        correlationId: '8bb1cfbd-401d-4605-b955-8210ed2477f4',
      },
      error: null,
    };

    const preview = mapQuotePreviewResponse(envelope);

    expect(preview.amountOut).toBe('0.450318543814579873646208');
    expect(preview.raw).toBe(envelope.data as Record<string, unknown>);
  });

  it('falls back to nested raw output when formatted output is absent', () => {
    const envelope: ApiResponseEnvelope<unknown> = {
      data: {
        quote: {
          amountOut: '450318543814579873646208',
        },
      },
      error: null,
    };

    expect(mapQuotePreviewResponse(envelope).amountOut).toBe(
      '450318543814579873646208'
    );
  });

  it('rejects a prepare package without an execution package', () => {
    const envelope: ApiResponseEnvelope<unknown> = {
      data: {
        protocol: 'near-intents',
        kind: 'swap',
        providerId: 'near-intents',
        quoteHashes: ['quote-hash'],
        signerId: 'signer.near',
        authMethod: 'near',
        deadlineTimestamp: 1_800_000_000,
        tokenDeltas: [{ assetId: 'near', amount: '-1' }],
      },
      error: null,
    };

    expect(() => mapApprovedPreparePackage(envelope)).toThrow(
      jasmine.objectContaining({
        code: 'INVALID_PREPARE_PACKAGE',
        message: 'Missing executionPackage from BFF',
      })
    );
  });
});
