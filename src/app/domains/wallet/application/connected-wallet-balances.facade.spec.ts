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
      ['loadBalancesWithMeta']
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
    balances.loadBalancesWithMeta.and.callFake(request =>
      of({
        balances: request?.assetIds ? [] : [nativeBalance],
        partial: false,
      })
    );

    const result = await firstValueFrom(
      facade.load({ account, network: 'eip155:1' }).pipe(skip(1))
    );

    expect(balances.loadBalancesWithMeta.calls.allArgs()).toEqual([
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
    expect(balances.loadBalancesWithMeta).not.toHaveBeenCalled();
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

  it('reports incomplete results when an empty response is partial', async () => {
    assets.loadAssets.and.returnValue(of([]));
    balances.loadBalancesWithMeta.and.returnValue(
      of({ balances: [], partial: true })
    );

    const result = await firstValueFrom(
      facade.load({ account, network: 'eip155:1' }).pipe(skip(1))
    );

    expect(result.status).toBe('partial');
    expect(result.rows).toEqual([]);
    expect(result.errorMessage).toBe('Some balances could not be loaded.');
  });

  it('keeps returned rows while reporting a partial response', async () => {
    assets.loadAssets.and.returnValue(of([]));
    balances.loadBalancesWithMeta.and.returnValue(
      of({ balances: [nativeBalance], partial: true })
    );

    const result = await firstValueFrom(
      facade.load({ account, network: 'eip155:1' }).pipe(skip(1))
    );

    expect(result.status).toBe('partial');
    expect(result.rows).toEqual([nativeBalance]);
  });

  it('rejects a balance returned for another network', async () => {
    assets.loadAssets.and.returnValue(of([]));
    balances.loadBalancesWithMeta.and.returnValue(
      of({
        balances: [{ ...nativeBalance, network: 'eip155:42161' }],
        partial: false,
      })
    );

    const result = await firstValueFrom(
      facade.load({ account, network: 'eip155:1' }).pipe(skip(1))
    );

    expect(result.status).toBe('error');
    expect(result.rows).toEqual([]);
  });

  it('rejects a balance returned for another wallet', async () => {
    assets.loadAssets.and.returnValue(of([]));
    balances.loadBalancesWithMeta.and.returnValue(
      of({
        balances: [
          {
            ...nativeBalance,
            walletAddress: '0x2222222222222222222222222222222222222222',
          },
        ],
        partial: false,
      })
    );

    const result = await firstValueFrom(
      facade.load({ account, network: 'eip155:1' }).pipe(skip(1))
    );

    expect(result.status).toBe('error');
    expect(result.rows).toEqual([]);
  });
});
