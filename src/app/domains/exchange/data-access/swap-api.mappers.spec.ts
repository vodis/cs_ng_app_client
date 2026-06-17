import { mapQuotePreviewResponse } from './swap-api.mappers';

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
});
