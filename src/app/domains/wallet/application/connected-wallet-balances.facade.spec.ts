/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { ExchangeAssetsService } from '@shared/services/exchange-assets.service';
import {
  WalletBalance,
  WalletBalancesService,
} from '@shared/services/wallet-balances.service';
import { firstValueFrom, of, skip, throwError } from 'rxjs';
import { ConnectedWalletBalancesFacade } from './connected-wallet-balances.facade';

describe('ConnectedWalletBalancesFacade', () => {
  const account = '0x1111111111111111111111111111111111111111';
  const nativeBalance: WalletBalance = {
    walletId: null,
    walletAddress: account,
    chainType: 'ethereum',
    network: 'eip155:1',
    assetId: 'eth',
    symbol: 'ETH',
    decimals: 18,
    balanceRaw: '1000000000000000000',
    balanceDecimal: '1',
    source: 'rpc_batch',
    fetchedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-01T00:01:00Z',
    stale: false,
  };

  let facade: ConnectedWalletBalancesFacade;
  let assets: jasmine.SpyObj<ExchangeAssetsService>;
  let balances: jasmine.SpyObj<WalletBalancesService>;

  beforeEach(() => {
    assets = jasmine.createSpyObj<ExchangeAssetsService>(
      'ExchangeAssetsService',
      ['loadAssets']
    );
    balances = jasmine.createSpyObj<WalletBalancesService>(
      'WalletBalancesService',
      ['loadBalances']
    );

    TestBed.configureTestingModule({
      providers: [
        ConnectedWalletBalancesFacade,
        { provide: ExchangeAssetsService, useValue: assets },
        { provide: WalletBalancesService, useValue: balances },
      ],
    });
    facade = TestBed.inject(ConnectedWalletBalancesFacade);
  });

  it('loads native and configured token balances through the host API layer', async () => {
    assets.loadAssets.and.returnValue(
      of([
        {
          assetId: 'eth',
          symbol: 'ETH',
          name: 'Ether',
          color: '#000',
          blockchain: 'eth',
          contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        },
        {
          assetId: 'usdc-ethereum',
          symbol: 'USDC',
          name: 'USD Coin',
          color: '#00f',
          blockchain: 'eth',
          contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        },
        {
          assetId: 'near',
          symbol: 'NEAR',
          name: 'NEAR',
          color: '#fff',
          blockchain: 'near',
        },
      ])
    );
    balances.loadBalances.and.callFake(request =>
      of(request?.assetIds ? [] : [nativeBalance])
    );

    const result = await firstValueFrom(
      facade.load({ account, network: 'eip155:1' }).pipe(skip(1))
    );

    expect(balances.loadBalances.calls.allArgs()).toEqual([
      [{ walletAddress: account, network: 'eip155:1' }],
      [
        {
          walletAddress: account,
          network: 'eip155:1',
          assetIds: ['usdc-ethereum'],
        },
      ],
    ]);
    expect(result.status).toBe('ready');
    expect(result.rows).toEqual([nativeBalance]);
  });

  it('rejects unsupported networks without issuing an API request', async () => {
    const result = await firstValueFrom(
      facade.load({ account, network: 'solana:mainnet' })
    );

    expect(result.status).toBe('error');
    expect(assets.loadAssets).not.toHaveBeenCalled();
    expect(balances.loadBalances).not.toHaveBeenCalled();
  });

  it('reports an error when asset discovery fails', async () => {
    assets.loadAssets.and.returnValue(
      throwError(() => new Error('assets unavailable'))
    );

    const result = await firstValueFrom(
      facade.load({ account, network: 'eip155:1' }).pipe(skip(1))
    );

    expect(result.status).toBe('error');
    expect(result.rows).toEqual([]);
  });
});
