import type { AgentAuthorizationRequest } from './portfolio.models';

export type AgentClientVerificationState =
  | 'metadata_document'
  | 'first_party'
  | 'unverified';

/** Prefer sanitized client name; fall back to verified host. */
export function agentDisplayName(
  request: Pick<AgentAuthorizationRequest, 'clientName' | 'clientHost'>
): string {
  const name = request.clientName?.trim();
  if (name) {
    return name;
  }

  const host = request.clientHost?.trim();
  if (host) {
    return host;
  }

  return 'Unknown client';
}

export function agentVerificationState(
  request: Pick<AgentAuthorizationRequest, 'clientVerification'>
): AgentClientVerificationState {
  const value = request.clientVerification;
  if (value === 'metadata_document' || value === 'first_party') {
    return value;
  }
  return 'unverified';
}

export function isVerifiedAgentClient(
  request: Pick<AgentAuthorizationRequest, 'clientVerification'>
): boolean {
  const state = agentVerificationState(request);
  return state === 'metadata_document' || state === 'first_party';
}

export function isHttpsUri(value: string | null | undefined): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  return /^https:\/\//i.test(trimmed);
}
