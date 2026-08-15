import type { ApiResponseEnvelope } from '@mfe-contracts/api-envelope';
import { parseApprovedSwapPrepareResponse } from './swap-prepare-response.parser';

describe('parseApprovedSwapPrepareResponse', () => {
  it('decodes an intent-sign response into a new host-owned model', () => {
    const data = validPrepareData();
    const parsed = parseApprovedSwapPrepareResponse({ data, error: null });

    expect(Object.is(parsed, data)).toBeFalse();
    expect(parsed).toEqual({
      protocol: 'near-intents',
      kind: 'swap',
      providerId: 'solver-relay',
      executionPackage: {
        providerId: 'solver-relay',
        mode: 'intent_sign',
        protocol: 'near-intents',
        requiredAction: 'sign',
        payload: { quoteHashes: ['quote-hash'] },
      },
      quoteHashes: ['quote-hash'],
      signerId: 'signer.near',
      authMethod: 'near',
      deadlineTimestamp: 1_800_000_000,
      tokenDeltas: [{ assetId: 'near', amount: '-1' }],
    });
  });

  it('rejects a response without an execution package', () => {
    const data = validPrepareData();
    delete data['executionPackage'];

    expectInvalidPreparePackage(
      { data, error: null },
      'data.executionPackage must be an object'
    );
  });

  it('rejects a mismatched execution mode and action', () => {
    const data = validPrepareData();
    data['executionPackage'] = {
      providerId: 'solver-relay',
      mode: 'intent_sign',
      protocol: 'near-intents',
      requiredAction: 'deposit',
      payload: {},
    };

    expectInvalidPreparePackage(
      { data, error: null },
      'data.executionPackage.requiredAction must be sign'
    );
  });

  it('decodes a deposit response without quote hashes', () => {
    const data = validPrepareData();
    data['quoteHashes'] = [];
    data['executionPackage'] = {
      providerId: 'one-click',
      mode: 'deposit_address',
      protocol: '1click',
      requiredAction: 'deposit',
      payload: { depositAddress: 'deposit.near' },
    };
    data['providerId'] = 'one-click';

    const parsed = parseApprovedSwapPrepareResponse({ data, error: null });

    expect(parsed.executionPackage).toEqual({
      providerId: 'one-click',
      mode: 'deposit_address',
      protocol: '1click',
      requiredAction: 'deposit',
      payload: { depositAddress: 'deposit.near' },
    });
    expect(parsed.quoteHashes).toEqual([]);
  });

  it('rejects malformed token deltas instead of asserting their type', () => {
    const data = validPrepareData();
    data['tokenDeltas'] = [{ assetId: 'near' }];

    expectInvalidPreparePackage(
      { data, error: null },
      'data.tokenDeltas[0].amount must be a string'
    );
  });

  it('accepts auth methods defined by the shared intents contract', () => {
    const data = validPrepareData();
    data['authMethod'] = 'webauthn';

    const parsed = parseApprovedSwapPrepareResponse({ data, error: null });

    expect(parsed.authMethod).toBe('webauthn');
  });

  it('rejects auth methods outside the shared intents contract', () => {
    const data = validPrepareData();
    data['authMethod'] = 'unsupported-chain';

    expectInvalidPreparePackage(
      { data, error: null },
      'data.authMethod is unsupported'
    );
  });
});

function validPrepareData(): Record<string, unknown> {
  return {
    protocol: 'near-intents',
    kind: 'swap',
    providerId: 'solver-relay',
    executionPackage: {
      providerId: 'solver-relay',
      mode: 'intent_sign',
      protocol: 'near-intents',
      requiredAction: 'sign',
      payload: { quoteHashes: ['quote-hash'] },
    },
    quoteHashes: ['quote-hash'],
    signerId: 'signer.near',
    authMethod: 'near',
    deadlineTimestamp: 1_800_000_000,
    tokenDeltas: [{ assetId: 'near', amount: '-1' }],
    transportOnlyField: 'discard me',
  };
}

function expectInvalidPreparePackage(
  envelope: ApiResponseEnvelope<unknown>,
  message: string
): void {
  expect(() => parseApprovedSwapPrepareResponse(envelope)).toThrow(
    jasmine.objectContaining({
      code: 'INVALID_PREPARE_PACKAGE',
      message,
      retryable: false,
    })
  );
}
