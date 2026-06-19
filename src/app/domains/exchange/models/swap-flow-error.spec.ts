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
    const error = {
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

  it('normalizes unknown errors with the fallback message', () => {
    expect(toSwapFlowError('validating', null, 'Swap failed')).toEqual({
      code: 'SWAP_FAILED',
      message: 'Swap failed',
      retryable: true,
      step: 'validating',
    });
  });
});
