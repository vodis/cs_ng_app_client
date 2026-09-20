import type { ApiErrorEnvelope } from '@mfe-contracts/api-envelope';
import type { SwapFlowError, SwapFlowState } from './swap.models';

type BaseSwapErrorInput = {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
};

const swapFlowStates = [
  'idle',
  'validating',
  'requestingQuote',
  'awaitingUserSignature',
  'submittingTransaction',
  'confirming',
  'completed',
  'failed',
] satisfies readonly SwapFlowState[];

export class BaseSwapError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor({ code, message, retryable, details }: BaseSwapErrorInput) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }

  toApiErrorEnvelope(): ApiErrorEnvelope {
    const envelope: ApiErrorEnvelope = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };

    if (this.details !== undefined) {
      envelope.details = this.details;
    }

    return envelope;
  }
}

export class SwapFlowException extends BaseSwapError {
  readonly step: SwapFlowState;

  constructor(step: SwapFlowState, input: BaseSwapErrorInput) {
    super(input);
    this.step = step;
  }

  toSwapFlowError(): SwapFlowError {
    return {
      ...this.toApiErrorEnvelope(),
      step: this.step,
    };
  }
}

export function toSwapFlowError(
  step: SwapFlowState,
  error: unknown,
  fallbackMessage: string
): SwapFlowError {
  if (error instanceof SwapFlowException) {
    return error.toSwapFlowError();
  }

  if (error instanceof BaseSwapError) {
    return {
      ...error.toApiErrorEnvelope(),
      step,
    };
  }

  const flowError = parseSwapFlowError(error);
  if (flowError) {
    return flowError;
  }

  const apiError = parseApiErrorEnvelope(error);
  if (apiError) {
    return {
      ...apiError,
      step,
    };
  }

  const httpError = parseHttpErrorResponse(error);
  if (httpError) {
    return {
      ...httpError,
      step,
    };
  }

  return {
    code: 'SWAP_FAILED',
    message: error instanceof Error ? error.message : fallbackMessage,
    retryable: true,
    step,
  };
}

export function parseSwapFlowError(error: unknown): SwapFlowError | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const step = error['step'];
  if (!isSwapFlowState(step)) {
    return undefined;
  }

  const apiError = parseApiErrorEnvelope(error);
  if (!apiError) {
    return undefined;
  }

  return {
    ...apiError,
    step,
  };
}

export function parseApiErrorEnvelope(
  error: unknown
): ApiErrorEnvelope | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const code = error['code'];
  const message = error['message'];
  const retryable = error['retryable'];

  if (
    typeof code !== 'string' ||
    typeof message !== 'string' ||
    typeof retryable !== 'boolean'
  ) {
    return undefined;
  }

  const envelope: ApiErrorEnvelope = {
    code,
    message,
    retryable,
  };

  if (error['details'] !== undefined) {
    envelope.details = error['details'];
  }

  return envelope;
}

function parseHttpErrorResponse(error: unknown): ApiErrorEnvelope | undefined {
  if (!isRecord(error) || !('error' in error)) {
    return undefined;
  }

  const body = error['error'];
  const typedBody = parseApiErrorEnvelope(body);
  if (typedBody) {
    return typedBody;
  }

  const status =
    typeof error['status'] === 'number' ? error['status'] : undefined;
  const bodyRecord = isRecord(body) ? body : undefined;
  const message = bodyRecord
    ? (readErrorMessage(bodyRecord['message']) ??
      readErrorMessage(bodyRecord['error']))
    : readErrorMessage(body);

  if (!message) {
    return undefined;
  }

  const code =
    bodyRecord && typeof bodyRecord['code'] === 'string'
      ? bodyRecord['code']
      : status
        ? `HTTP_${status}`
        : 'HTTP_ERROR';
  const retryable =
    bodyRecord && typeof bodyRecord['retryable'] === 'boolean'
      ? bodyRecord['retryable']
      : status === undefined || status === 0 || status === 408 || status === 429
        ? true
        : status >= 500;

  return {
    code,
    message,
    retryable,
    ...(bodyRecord?.['details'] !== undefined
      ? { details: bodyRecord['details'] }
      : {}),
  };
}

function readErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(item => typeof item === 'string')
  ) {
    return value.join(' ');
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSwapFlowState(value: unknown): value is SwapFlowState {
  return swapFlowStates.some(state => state === value);
}
