import type { ApiResponseEnvelope } from '@mfe-contracts/api-envelope';
import type { ApprovedIntentPrepareRequest } from '@mfe-contracts/intent-prepare.contract';
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

function readStringArray(
  record: Record<string, unknown>,
  key: string
): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.every(item => typeof item === 'string') ? value : undefined;
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

export function mapApprovedPreparePackage(
  envelope: ApiResponseEnvelope<unknown>
): ApprovedIntentPrepareRequest {
  const payload = unwrapData(envelope);
  assertApprovedPreparePackage(payload);
  return payload;
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

function assertApprovedPreparePackage(
  payload: Record<string, unknown>
): asserts payload is ApprovedIntentPrepareRequest {
  const protocol = payload['protocol'];
  const kind = payload['kind'];
  const quoteHashes = readStringArray(payload, 'quoteHashes');
  const providerId = readString(payload, 'providerId');
  const signerId = readString(payload, 'signerId');
  const authMethod = readString(payload, 'authMethod');
  const deadlineTimestamp = payload['deadlineTimestamp'];
  const tokenDeltas = payload['tokenDeltas'];

  if (protocol !== 'near-intents') {
    invalidPreparePackage('Unsupported prepare protocol');
  }

  if (kind !== 'swap' && kind !== 'transfer') {
    invalidPreparePackage('Missing prepare kind');
  }

  if (!providerId) {
    invalidPreparePackage('Missing providerId from BFF');
  }

  if (!quoteHashes?.length) {
    invalidPreparePackage('Missing quoteHashes from BFF');
  }

  if (!signerId || !authMethod) {
    invalidPreparePackage('Missing signerId or authMethod');
  }

  if (
    typeof deadlineTimestamp !== 'number' ||
    !Number.isFinite(deadlineTimestamp)
  ) {
    invalidPreparePackage('Missing deadlineTimestamp');
  }

  if (!Array.isArray(tokenDeltas) || tokenDeltas.length === 0) {
    invalidPreparePackage('Missing tokenDeltas');
  }
}

function invalidPreparePackage(message: string): never {
  throw {
    code: 'INVALID_PREPARE_PACKAGE',
    message,
    retryable: false,
  };
}
