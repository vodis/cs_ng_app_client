import type { Observable } from 'rxjs';
import type { LoginMethod } from './auth-session.types';

export type AuthProviderUser = {
  id?: string;
  email?: { address?: string };
  linkedAccounts?: Array<Record<string, unknown>>;
  wallet?: AuthProviderWallet;
};

export type AuthProviderWallet = {
  id?: string;
  address?: string;
  walletClientType?: string;
  chainType?: string;
};

export type AuthProviderStatus = 'loading' | 'disabled' | 'ready' | 'failed';

export type AuthProviderState = {
  status: AuthProviderStatus;
  loginMethods: LoginMethod[];
  error?: string;
};

export abstract class AuthProviderGateway {
  abstract readonly state$: Observable<AuthProviderState>;

  abstract get state(): AuthProviderState;
  abstract initialize(): Promise<void>;
  abstract login(method: LoginMethod): Promise<AuthProviderUser | void>;
  abstract getAccessToken(): Promise<string | null>;
  abstract getUser(): Promise<AuthProviderUser | null>;
  abstract getEmbeddedWallet(): Promise<AuthProviderWallet | null>;
}
