import type { SwapFlowError } from './swap.models';
import {
  BaseSwapError,
  SwapFlowException,
  parseApiErrorEnvelope,
  parseSwapFlowError,
  toSwapFlowError,
} from './swap-flow-error';

describe('swap flow error utilities', () => {
  it('preserves SwapFlowException fields', () => {
    const error = new SwapFlowException('awaitingUserSignature', {
      code: 'WALLET_REJECTED',
      message: 'User rejected signature',
      retryable: true,
      details: { source: 'wallet' },
    });

    expect(toSwapFlowError('validating', error, 'fallback')).toEqual({
      code: 'WALLET_REJECTED',
      message: 'User rejected signature',
      retryable: true,
      details: { source: 'wallet' },
      step: 'awaitingUserSignature',
    });
  });

  it('applies the current step to base swap errors', () => {
    const error = new BaseSwapError({
      code: 'QUOTE_FAILED',
      message: 'Quote unavailable',
      retryable: true,
    });

    expect(toSwapFlowError('requestingQuote', error, 'fallback')).toEqual({
      code: 'QUOTE_FAILED',
      message: 'Quote unavailable',
      retryable: true,
      step: 'requestingQuote',
    });
  });

  it('parses serialized swap flow errors', () => {
    const error: SwapFlowError = {
      code: 'INTENT_FAILED',
      message: 'Intent relay failed',
      retryable: false,
      step: 'submittingTransaction',
    };

    expect(parseSwapFlowError(error)).toEqual(error);
    expect(toSwapFlowError('validating', error, 'fallback')).toEqual(error);
  });

  it('parses api error envelopes without trusting arbitrary objects', () => {
    expect(
      parseApiErrorEnvelope({
        code: 'API_FAILED',
        message: 'Backend rejected request',
        retryable: false,
        details: { status: 400 },
      })
    ).toEqual({
      code: 'API_FAILED',
      message: 'Backend rejected request',
      retryable: false,
      details: { status: 400 },
    });

    expect(
      parseApiErrorEnvelope({
        code: 'API_FAILED',
        message: 'Backend rejected request',
        retryable: 'false',
      })
    ).toBeUndefined();
  });

  it('unwraps the current backend HTTP quote error body for the UI', () => {
    expect(
      toSwapFlowError(
        'requestingQuote',
        {
          status: 400,
          error: {
            code: 'NO_QUOTE_AVAILABLE',
            message: 'No quote is available for this pair.',
          },
        },
        'Quote request failed'
      )
    ).toEqual({
      code: 'NO_QUOTE_AVAILABLE',
      message: 'No quote is available for this pair.',
      retryable: false,
      step: 'requestingQuote',
    });
  });

  it('preserves retryability from a typed nested backend error', () => {
    expect(
      toSwapFlowError(
        'requestingQuote',
        {
          status: 503,
          error: {
            code: 'QUOTE_PROVIDER_UNAVAILABLE',
            message: 'Quote provider is temporarily unavailable.',
            retryable: true,
          },
        },
        'Quote request failed'
      )
    ).toEqual({
      code: 'QUOTE_PROVIDER_UNAVAILABLE',
      message: 'Quote provider is temporarily unavailable.',
      retryable: true,
      step: 'requestingQuote',
    });
  });

  it('normalizes unknown errors with the fallback message', () => {
    expect(toSwapFlowError('validating', null, 'Swap failed')).toEqual({
      code: 'SWAP_FAILED',
      message: 'Swap failed',
      retryable: true,
      step: 'validating',
    });
  });
});
