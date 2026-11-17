import {
  agentDisplayName,
  agentVerificationState,
  isHttpsUri,
  isVerifiedAgentClient,
} from './agent-authorization-display.utils';

describe('agent-authorization-display.utils', () => {
  it('prefers clientName and falls back to clientHost', () => {
    expect(
      agentDisplayName({ clientName: 'ChatGPT', clientHost: 'chatgpt.com' })
    ).toBe('ChatGPT');
    expect(
      agentDisplayName({ clientName: '  ', clientHost: 'chatgpt.com' })
    ).toBe('chatgpt.com');
    expect(agentDisplayName({ clientName: '', clientHost: null })).toBe(
      'Unknown client'
    );
  });

  it('treats missing verification as unverified', () => {
    expect(agentVerificationState({})).toBe('unverified');
    expect(agentVerificationState({ clientVerification: null })).toBe(
      'unverified'
    );
    expect(
      agentVerificationState({ clientVerification: 'metadata_document' })
    ).toBe('metadata_document');
    expect(isVerifiedAgentClient({ clientVerification: 'first_party' })).toBe(
      true
    );
    expect(isVerifiedAgentClient({ clientVerification: 'unverified' })).toBe(
      false
    );
  });

  it('accepts only https URIs for logo and client links', () => {
    expect(isHttpsUri('https://chatgpt.com')).toBeTrue();
    expect(isHttpsUri('http://chatgpt.com')).toBeFalse();
    expect(isHttpsUri(null)).toBeFalse();
  });
});
