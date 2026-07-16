/// <reference types="jasmine" />

import { BehaviorSubject, of } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let walletsService: jasmine.SpyObj<WalletsService>;
  let walletGatewayBridge: jasmine.SpyObj<WalletGatewayBridgeService>;
  let sessionSubject: BehaviorSubject<AuthSession | null>;

  const enabledSession: AuthSession = {
    user: {
      id: 'account-1',
      providerUserId: 'provider-1',
      sessionId: 'session-1',
      email: 'user@example.com',
      authMethod: 'email',
      passkeyEnabled: true,
    },
    wallets: [],
  };

  const disabledSession: AuthSession = {
    user: {
      ...enabledSession.user,
      passkeyEnabled: false,
    },
    wallets: [],
  };

  const linkedWalletSession: AuthSession = {
    ...enabledSession,
    wallets: [
      {
        id: 'wallet-1',
        providerWalletId: 'provider-wallet-1',
        address: '0x6e1a000000000000000000000000000000007690',
        chainType: 'ethereum',
        walletType: 'embedded',
        source: 'provider',
        isPrimary: true,
      },
    ],
  };

  beforeEach(() => {
    sessionSubject = new BehaviorSubject<AuthSession | null>(disabledSession);
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      [
        'enablePasskey',
        'reloadWallets',
        'loadBalances',
        'setPrimaryWallet',
        'deleteWallet',
        'requestDeletion',
        'logout',
      ],
      {
        session$: sessionSubject.asObservable(),
        loading$: of(false),
        passkeyLinkEnabled: true,
        passkeyLoginEnabled: true,
      }
    );
    authSession.enablePasskey.and.resolveTo(enabledSession);
    authSession.loadBalances.and.resolveTo([]);
    walletsService = jasmine.createSpyObj<WalletsService>('WalletsService', [
      'requestOpen',
    ]);
    walletGatewayBridge = jasmine.createSpyObj<WalletGatewayBridgeService>(
      'WalletGatewayBridgeService',
      ['syncConnectedWallet']
    );
    walletGatewayBridge.syncConnectedWallet.and.resolveTo({
      status: 'connected',
      account: linkedWalletSession.wallets[0].address,
      chainId: null,
      isVerified: false,
      safetyStatus: null,
      isBypassed: false,
      executionState: 'operating.idle',
    });

    component = new ProfileComponent(
      authSession,
      walletsService,
      walletGatewayBridge
    );
    component.ngOnInit();
  });

  it('allows enabling passkey when it is not enabled', async () => {
    expect(component.canEnablePasskey()).toBeTrue();

    await component.enablePasskey();

    expect(authSession.enablePasskey).toHaveBeenCalledTimes(1);
    expect(component.passkeyMessage).toBe('Passkey authentication enabled');
  });

  it('hides passkey enablement when linking is disabled', () => {
    Object.defineProperty(authSession, 'passkeyLinkEnabled', {
      configurable: true,
      get: () => false,
    });

    expect(component.canEnablePasskey()).toBeFalse();
  });

  it('shows linked-only messaging when passkey login is unavailable', () => {
    sessionSubject.next(enabledSession);
    Object.defineProperty(authSession, 'passkeyLoginEnabled', {
      configurable: true,
      get: () => false,
    });

    expect(component.isPasskeyLinked()).toBeTrue();
    expect(component.isPasskeyLoginAvailable()).toBeFalse();
  });

  it('treats linked backend wallets as connected for the wallet CTA', () => {
    expect(component.hasLinkedWallets()).toBeFalse();

    sessionSubject.next(linkedWalletSession);

    expect(component.hasLinkedWallets()).toBeTrue();
  });

  it('syncs the connected wallet then opens the wallets MFE', async () => {
    await component.openWalletModal();

    expect(walletGatewayBridge.syncConnectedWallet).toHaveBeenCalledTimes(1);
    expect(walletsService.requestOpen).toHaveBeenCalledTimes(1);
  });

  it('still opens the wallets MFE when sync fails', async () => {
    walletGatewayBridge.syncConnectedWallet.and.rejectWith(
      new Error('gateway unavailable')
    );

    await component.openWalletModal();

    expect(walletsService.requestOpen).toHaveBeenCalledTimes(1);
  });
});
