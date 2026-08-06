import { AppLoggerService } from '@core/logging/app-logger.service';
import {
  WalletConnectionSnapshot,
  WalletsMfeMountApi,
} from '@mfe-contracts/wallet-mfe.types';
import { WalletGatewayBridgeService } from './wallet-gateway.bridge.service';

describe('WalletGatewayBridgeService', () => {
  let service: WalletGatewayBridgeService;
  let mountApi: WalletsMfeMountApi;

  const account = '0x1111111111111111111111111111111111111111';
  const connectedSnapshot: WalletConnectionSnapshot = {
    status: 'connected',
    account,
    chainId: 1,
    isVerified: true,
    safetyStatus: 'safe',
    isBypassed: false,
    executionState: 'operating.idle',
  };

  beforeEach(() => {
    service = new WalletGatewayBridgeService(
      jasmine.createSpyObj<AppLoggerService>('AppLoggerService', ['log'])
    );
    mountApi = {
      unmount: jasmine.createSpy('unmount'),
      subscribe: jasmine
        .createSpy('subscribe')
        .and.returnValue(jasmine.createSpy('unsubscribe')),
      getSnapshot: jasmine
        .createSpy('getSnapshot')
        .and.returnValue(connectedSnapshot),
      sendGatewayEvent: jasmine.createSpy('sendGatewayEvent'),
    };
  });

  afterEach(() => {
    window.localStorage.removeItem('mfe-wallets.session.v1');
  });

  it('delegates embedded wallet creation to the mounted wallet MFE', async () => {
    const createEmbeddedWallet = jasmine
      .createSpy('createEmbeddedWallet')
      .and.resolveTo({
        account,
        chainId: connectedSnapshot.chainId,
        walletType: 'embedded',
        source: 'provider',
      });
    mountApi.createEmbeddedWallet = createEmbeddedWallet;
    service.registerMountApi(mountApi);

    await expectAsync(service.createEmbeddedWallet()).toBeResolvedTo({
      account,
      chainId: connectedSnapshot.chainId,
      walletType: 'embedded',
      source: 'provider',
    });
    expect(createEmbeddedWallet).toHaveBeenCalledTimes(1);
  });

  it('fails with a retryable gateway error when embedded wallet creation is unavailable', async () => {
    service.registerMountApi(mountApi);

    await expectAsync(service.createEmbeddedWallet()).toBeRejectedWith(
      jasmine.objectContaining({
        code: 'GATEWAY_UNAVAILABLE',
        retryable: true,
      })
    );
  });

  it('delegates wallet disconnect and publishes a disconnected snapshot', () => {
    mountApi.disconnectWallet = jasmine.createSpy('disconnectWallet');
    service.registerMountApi(mountApi);
    let latestSnapshot: WalletConnectionSnapshot | undefined;
    const subscription = service.snapshot$.subscribe(snapshot => {
      latestSnapshot = snapshot;
    });

    service.disconnectWallet();

    expect(mountApi.disconnectWallet).toHaveBeenCalledTimes(1);
    expect(latestSnapshot).toEqual(
      jasmine.objectContaining({
        status: 'disconnected',
        account: null,
        chainId: null,
      })
    );
    subscription.unsubscribe();
  });

  it('clears the legacy wallet session fallback when disconnect is unavailable', () => {
    window.localStorage.setItem('mfe-wallets.session.v1', 'cached');
    service.registerMountApi(mountApi);

    service.disconnectWallet();

    expect(window.localStorage.getItem('mfe-wallets.session.v1')).toBeNull();
  });

  it('returns the current snapshot when a wallet is already connected', async () => {
    service.registerMountApi(mountApi);

    await expectAsync(service.syncConnectedWallet()).toBeResolvedTo(
      connectedSnapshot
    );
  });

  it('delegates connected-wallet sync to the mounted wallet MFE', async () => {
    const idleSnapshot: WalletConnectionSnapshot = {
      ...connectedSnapshot,
      status: 'idle',
      account: null,
      chainId: null,
      isVerified: false,
    };
    (mountApi.getSnapshot as jasmine.Spy).and.returnValue(idleSnapshot);
    const syncConnectedWallet = jasmine
      .createSpy('syncConnectedWallet')
      .and.resolveTo(connectedSnapshot);
    mountApi.syncConnectedWallet = syncConnectedWallet;
    service.registerMountApi(mountApi);

    await expectAsync(service.syncConnectedWallet()).toBeResolvedTo(
      connectedSnapshot
    );
    expect(syncConnectedWallet).toHaveBeenCalledTimes(1);
  });
});
