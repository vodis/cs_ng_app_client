import type { ApiResponseEnvelope } from '@mfe-contracts/api-envelope';
import type { SwapQuotePreview } from '@domains/exchange/models/swap.models';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

export function mapQuotePreviewResponse(
  envelope: ApiResponseEnvelope<unknown>
): SwapQuotePreview {
  const payload = unwrapData(envelope);
  const quote = isRecord(payload['quote']) ? payload['quote'] : undefined;
  const amountOut =
    readString(payload, 'amountOutFormatted') ??
    readString(payload, 'destinationAmountFormatted') ??
    readString(payload, 'toAmountFormatted') ??
    (quote ? readString(quote, 'amountOutFormatted') : undefined) ??
    (quote ? readString(quote, 'destinationAmountFormatted') : undefined) ??
    (quote ? readString(quote, 'toAmountFormatted') : undefined) ??
    readString(payload, 'amountOut') ??
    readString(payload, 'destinationAmount') ??
    readString(payload, 'toAmount') ??
    (quote ? readString(quote, 'amountOut') : undefined) ??
    (quote ? readString(quote, 'amount_out') : undefined) ??
    '';

  return {
    amountOut,
    raw: payload,
  };
}

function unwrapData(
  envelope: ApiResponseEnvelope<unknown>
): Record<string, unknown> {
  if (envelope.error) {
    throw envelope.error;
  }

  if (!isRecord(envelope.data)) {
    throw {
      code: 'INVALID_RESPONSE',
      message: 'Swap API returned an empty prepare package',
      retryable: false,
    };
  }

  return envelope.data;
}
