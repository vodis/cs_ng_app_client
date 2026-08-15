import type { ApiResponseEnvelope } from '@mfe-contracts/api-envelope';
import type {
  NearIntentsTokenDelta,
  SwapAuthMethod,
} from '@mfe-contracts/intent-prepare.contract';
import type {
  ApprovedSwapExecutionPackage,
  ApprovedSwapPreparePackage,
} from '@domains/exchange/models/swap.models';

type JsonRecord = Record<string, unknown>;

/**
 * Decodes the untrusted BFF response into the host-owned swap model.
 * A new object is returned so transport-only fields cannot leak downstream.
 */
export function parseApprovedSwapPrepareResponse(
  envelope: ApiResponseEnvelope<unknown>
): ApprovedSwapPreparePackage {
  if (envelope.error) {
    throw envelope.error;
  }

  const payload = readRecord(envelope.data, 'data');
  readLiteral(payload['protocol'], 'near-intents', 'data.protocol');
  readLiteral(payload['kind'], 'swap', 'data.kind');

  const providerId = readNonEmptyString(
    payload['providerId'],
    'data.providerId'
  );
  const executionPackage = parseExecutionPackage(
    payload['executionPackage'],
    providerId
  );
  const quoteHashes = readStringArray(
    payload['quoteHashes'],
    'data.quoteHashes',
    executionPackage.mode === 'intent_sign'
  );
  const nonce = readOptionalString(payload['nonce'], 'data.nonce');
  const referral = readOptionalString(payload['referral'], 'data.referral');
  const memo = readOptionalString(payload['memo'], 'data.memo');
  const appFee = readOptionalTokenDeltas(payload['appFee'], 'data.appFee');
  const appFeeRecipient = readOptionalString(
    payload['appFeeRecipient'],
    'data.appFeeRecipient'
  );

  return {
    protocol: 'near-intents',
    kind: 'swap',
    providerId,
    executionPackage,
    quoteHashes,
    signerId: readNonEmptyString(payload['signerId'], 'data.signerId'),
    authMethod: readSwapAuthMethod(payload['authMethod']),
    deadlineTimestamp: readFiniteNumber(
      payload['deadlineTimestamp'],
      'data.deadlineTimestamp'
    ),
    tokenDeltas: readTokenDeltas(payload['tokenDeltas'], 'data.tokenDeltas'),
    ...(nonce !== undefined ? { nonce } : {}),
    ...(referral !== undefined ? { referral } : {}),
    ...(memo !== undefined ? { memo } : {}),
    ...(appFee ? { appFee } : {}),
    ...(appFeeRecipient !== undefined ? { appFeeRecipient } : {}),
  };
}

function parseExecutionPackage(
  value: unknown,
  expectedProviderId: string
): ApprovedSwapExecutionPackage {
  const executionPackage = readRecord(value, 'data.executionPackage');
  const providerId = readNonEmptyString(
    executionPackage['providerId'],
    'data.executionPackage.providerId'
  );
  const protocol = readNonEmptyString(
    executionPackage['protocol'],
    'data.executionPackage.protocol'
  );
  const payload = {
    ...readRecord(executionPackage['payload'], 'data.executionPackage.payload'),
  };

  if (providerId !== expectedProviderId) {
    invalidPreparePackage(
      'data.executionPackage.providerId must match data.providerId'
    );
  }

  switch (executionPackage['mode']) {
    case 'intent_sign':
      readLiteral(
        executionPackage['requiredAction'],
        'sign',
        'data.executionPackage.requiredAction'
      );
      readLiteral(protocol, 'near-intents', 'data.executionPackage.protocol');
      return {
        providerId,
        mode: 'intent_sign',
        protocol: 'near-intents',
        requiredAction: 'sign',
        payload,
      };
    case 'deposit_address':
      readLiteral(
        executionPackage['requiredAction'],
        'deposit',
        'data.executionPackage.requiredAction'
      );
      return {
        providerId,
        mode: 'deposit_address',
        protocol,
        requiredAction: 'deposit',
        payload,
      };
    case 'evm_transaction':
      readLiteral(
        executionPackage['requiredAction'],
        'submit_transaction',
        'data.executionPackage.requiredAction'
      );
      return {
        providerId,
        mode: 'evm_transaction',
        protocol,
        requiredAction: 'submit_transaction',
        payload,
      };
    case 'external_redirect':
      readLiteral(
        executionPackage['requiredAction'],
        'redirect',
        'data.executionPackage.requiredAction'
      );
      return {
        providerId,
        mode: 'external_redirect',
        protocol,
        requiredAction: 'redirect',
        payload,
      };
    default:
      return invalidPreparePackage('data.executionPackage.mode is unsupported');
  }
}

function readRecord(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) {
    return invalidPreparePackage(`${path} must be an object`);
  }

  return value;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown, path: string): string {
  const parsed = readString(value, path);
  if (parsed.length === 0) {
    return invalidPreparePackage(`${path} must be a non-empty string`);
  }

  return parsed;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    return invalidPreparePackage(`${path} must be a string`);
  }

  return value;
}

function readLiteral<T extends string>(
  value: unknown,
  expected: T,
  path: string
): T {
  if (value !== expected) {
    return invalidPreparePackage(`${path} must be ${expected}`);
  }

  return expected;
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return invalidPreparePackage(`${path} must be a finite number`);
  }

  return value;
}

function readStringArray(
  value: unknown,
  path: string,
  requireValue: boolean
): string[] {
  if (
    !Array.isArray(value) ||
    (requireValue && value.length === 0) ||
    value.some(item => typeof item !== 'string' || item.length === 0)
  ) {
    return invalidPreparePackage(`${path} must contain non-empty strings`);
  }

  return [...value];
}

function readTokenDeltas(
  value: unknown,
  path: string
): NearIntentsTokenDelta[] {
  if (!Array.isArray(value) || value.length === 0) {
    return invalidPreparePackage(`${path} must be a non-empty array`);
  }

  return value.map((item, index) => {
    const tokenDelta = readRecord(item, `${path}[${index}]`);
    return {
      assetId: readNonEmptyString(
        tokenDelta['assetId'],
        `${path}[${index}].assetId`
      ),
      amount: readNonEmptyString(
        tokenDelta['amount'],
        `${path}[${index}].amount`
      ),
    };
  });
}

function readSwapAuthMethod(value: unknown): SwapAuthMethod {
  switch (value) {
    case 'evm':
    case 'near':
    case 'solana':
    case 'stellar':
    case 'ton':
    case 'tron':
    case 'webauthn':
      return value;
    default:
      return invalidPreparePackage('data.authMethod is unsupported');
  }
}

function readOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readString(value, path);
}

function readOptionalTokenDeltas(
  value: unknown,
  path: string
): NearIntentsTokenDelta[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readTokenDeltas(value, path);
}

function invalidPreparePackage(message: string): never {
  throw {
    code: 'INVALID_PREPARE_PACKAGE',
    message,
    retryable: false,
  };
}
