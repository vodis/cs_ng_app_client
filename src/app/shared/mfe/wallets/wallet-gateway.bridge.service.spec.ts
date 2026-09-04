import { AppLoggerService } from '@core/logging/app-logger.service';
import { IDLE_WALLET_BALANCES_SNAPSHOT } from '@mfe-contracts/wallet-balances.types';
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
    identity: {
      connectorId: 'metamask',
      address: account,
      chainType: 'ethereum',
      walletType: 'external',
    },
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

  it('resets the gateway when a connection is dismissed', () => {
    service.registerMountApi(mountApi);

    service.resetConnection();

    expect(mountApi.sendGatewayEvent).toHaveBeenCalledOnceWith({
      type: 'RESET',
    });
  });

  it('ignores connection reset when the wallet MFE is not mounted', () => {
    expect(() => service.resetConnection()).not.toThrow();
  });

  it('delegates connected-wallet sync to the mounted wallet MFE', async () => {
    const idleSnapshot: WalletConnectionSnapshot = {
      ...connectedSnapshot,
      status: 'idle',
      account: null,
      chainId: null,
      isVerified: false,
    };
    mountApi.getSnapshot = jasmine
      .createSpy('getSnapshot')
      .and.returnValue(idleSnapshot);
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

  it('keeps gateway-sourced EVM rows only while the snapshot is connected', () => {
    mountApi.disconnectWallet = jasmine.createSpy('disconnectWallet');
    service.registerMountApi(mountApi);
    service.updateSnapshot(connectedSnapshot);
    service.updateBalances({
      status: 'ready',
      account,
      chainId: 1,
      rows: [
        {
          walletAddress: account,
          chainType: 'ethereum',
          network: 'eip155:1',
          chainId: 1,
          assetId: 'eth',
          symbol: 'ETH',
          decimals: 18,
          balanceRaw: '1',
          balanceDecimal: '1',
          fetchedAt: '2026-01-01T00:00:00Z',
          expiresAt: '2026-01-01T00:01:00Z',
          stale: false,
        },
      ],
    });

    let latest = IDLE_WALLET_BALANCES_SNAPSHOT;
    const subscription = service.balances$.subscribe(snapshot => {
      latest = snapshot;
    });
    expect(latest.rows.length).toBe(1);

    service.disconnectWallet();
    expect(latest).toEqual(IDLE_WALLET_BALANCES_SNAPSHOT);
    subscription.unsubscribe();
  });

  it('asks the gateway to sync balances for a selected EVM chain', () => {
    service.registerMountApi(mountApi);
    service.requestBalancesSync(42161);
    expect(mountApi.sendGatewayEvent).toHaveBeenCalledOnceWith({
      type: 'BALANCES_SYNC_REQUESTED',
      chainId: 42161,
    });
  });

  it('clears gateway-sourced balances when the wallet MFE unmounts', () => {
    service.registerMountApi(mountApi);
    service.updateSnapshot(connectedSnapshot);
    service.updateBalances({
      status: 'ready',
      account,
      chainId: 1,
      rows: [
        {
          walletAddress: account,
          chainType: 'ethereum',
          network: 'eip155:1',
          chainId: 1,
          assetId: 'eth',
          symbol: 'ETH',
          decimals: 18,
          balanceRaw: '1',
          balanceDecimal: '1',
          fetchedAt: '2026-01-01T00:00:00Z',
          expiresAt: '2026-01-01T00:01:00Z',
          stale: false,
        },
      ],
    });

    let latest = IDLE_WALLET_BALANCES_SNAPSHOT;
    const subscription = service.balances$.subscribe(snapshot => {
      latest = snapshot;
    });

    service.clearMountApi();
    expect(latest).toEqual(IDLE_WALLET_BALANCES_SNAPSHOT);
    subscription.unsubscribe();
  });

  it('ignores balance updates while the gateway snapshot is not connected', () => {
    service.updateBalances({
      status: 'ready',
      account,
      chainId: 1,
      rows: [
        {
          walletAddress: account,
          chainType: 'ethereum',
          network: 'eip155:1',
          chainId: 1,
          assetId: 'eth',
          symbol: 'ETH',
          decimals: 18,
          balanceRaw: '1',
          balanceDecimal: '1',
          fetchedAt: '2026-01-01T00:00:00Z',
          expiresAt: '2026-01-01T00:01:00Z',
          stale: false,
        },
      ],
    });

    let latest = IDLE_WALLET_BALANCES_SNAPSHOT;
    const subscription = service.balances$.subscribe(snapshot => {
      latest = snapshot;
    });
    expect(latest).toEqual(IDLE_WALLET_BALANCES_SNAPSHOT);
    subscription.unsubscribe();
  });
});
