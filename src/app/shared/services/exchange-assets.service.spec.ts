import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ExchangeToken } from '@shared/models/exchange-token.model';
import { ExchangeAssetsService } from './exchange-assets.service';

describe('ExchangeAssetsService', () => {
  let service: ExchangeAssetsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ExchangeAssetsService],
    });

    service = TestBed.inject(ExchangeAssetsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('refreshes asset prices, coalesces slow requests, and recovers after errors', fakeAsync(() => {
    const updates: ExchangeToken[][] = [];
    const subscription = service
      .watchPrices()
      .subscribe(tokens => updates.push(tokens));
    tick(60_000);
    const first = httpMock.expectOne(`${environment.apiUrl}/api/v1/assets`);
    tick(60_000);
    httpMock.expectNone(`${environment.apiUrl}/api/v1/assets`);
    first.flush({
      data: [
        {
          assetId: 'token-a',
          symbol: 'USDC',
          blockchain: 'near',
          price: '1',
          priceUpdatedAt: '2026-10-08T00:00:00Z',
        },
        {
          assetId: 'token-b',
          symbol: 'USDC',
          blockchain: 'eth',
          price: '2',
          priceUpdatedAt: '2026-10-08T00:00:00Z',
        },
      ],
    });
    expect(
      updates[0].find(token => token.assetId === 'token-b')?.priceUsd
    ).toBe('2');
    expect(updates[0][0].priceUpdatedAt).toBe('2026-10-08T00:00:00Z');
    tick(60_000);
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/assets`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(updates.length).toBe(1);
    tick(60_000);
    httpMock.expectOne(`${environment.apiUrl}/api/v1/assets`).flush({
      data: [
        {
          assetId: 'token-b',
          symbol: 'USDC',
          blockchain: 'eth',
          price: '3',
          priceUpdatedAt: '2026-10-08T00:04:00Z',
        },
      ],
    });
    expect(updates[1][0].priceUsd).toBe('3');
    subscription.unsubscribe();
    tick(60_000);
    httpMock.expectNone(`${environment.apiUrl}/api/v1/assets`);
  }));

  it('preserves backend native balance identity and decimal price strings', () => {
    let tokens: ExchangeToken[] = [];
    service.loadAssets().subscribe(result => (tokens = result));
    httpMock.expectOne(`${environment.apiUrl}/api/v1/assets`).flush({
      data: [
        {
          assetId: 'nep141:eth.omft.near',
          balanceAssetId: 'eip155:1/native',
          symbol: 'ETH',
          blockchain: 'eth',
          decimals: 18,
          price: '2568.88',
        },
      ],
    });
    expect(tokens[0].balanceAssetId).toBe('eip155:1/native');
    expect(tokens[0].priceUsd).toBe('2568.88');
  });

  it('should map assets from the API into exchange tokens', () => {
    let tokens: ExchangeToken[] = [];

    service.loadAssets().subscribe(result => {
      tokens = result;
    });

    const request = httpMock.expectOne(`${environment.apiUrl}/api/v1/assets`);
    expect(request.request.method).toBe('GET');
    request.flush({
      data: [
        {
          assetId: 'nep141:wrap.near',
          defuseAssetId: 'nep141:wrap.near',
          symbol: 'wNEAR',
          name: 'NEAR Protocol',
          icon: 'https://example.com/near.png',
          decimals: 24,
          blockchain: 'near',
        },
        {
          assetId: 'nep141:eth-usdc.omft.near',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          blockchain: 'eth',
        },
        {
          assetId:
            'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          blockchain: 'near',
        },
      ],
    });

    expect(tokens).toEqual([
      {
        assetId: 'near:native',
        executionAssetId: 'nep141:wrap.near',
        symbol: 'NEAR',
        displaySymbol: 'NEAR',
        name: 'NEAR Protocol',
        icon: 'https://example.com/near.png',
        decimals: 24,
        color: '#2fd17c',
        blockchain: 'near',
        contractAddress: undefined,
      },
      {
        assetId: 'nep141:eth-usdc.omft.near',
        executionAssetId: 'nep141:eth-usdc.omft.near',
        symbol: 'USDC',
        displaySymbol: 'USDC',
        name: 'USD Coin',
        icon: undefined,
        decimals: 6,
        color: '#2f8cff',
        blockchain: 'eth',
      },
      {
        assetId:
          'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
        executionAssetId:
          'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
        symbol: 'USDC',
        displaySymbol: 'USDC',
        name: 'USD Coin',
        icon: undefined,
        decimals: 6,
        color: '#2f8cff',
        blockchain: 'near',
      },
      {
        assetId: 'nep141:wrap.near',
        executionAssetId: 'nep141:wrap.near',
        symbol: 'wNEAR',
        displaySymbol: 'wNEAR',
        name: 'NEAR Protocol',
        icon: 'https://example.com/near.png',
        decimals: 24,
        color: '#2fd17c',
        blockchain: 'near',
      },
    ]);
  });

  it('keeps PUBLIC_NEAR distinct from native and wrapped NEAR', () => {
    let tokens: ExchangeToken[] = [];
    service.loadAssets().subscribe(result => (tokens = result));

    httpMock.expectOne(`${environment.apiUrl}/api/v1/assets`).flush({
      data: [
        {
          assetId: 'nep141:wrap.near',
          defuseAssetId: 'nep141:wrap.near',
          symbol: 'wNEAR',
          decimals: 24,
          blockchain: 'near',
        },
        {
          assetId: 'nep141:public-near.near',
          defuseAssetId: 'nep141:public-near.near',
          symbol: 'PUBLIC_NEAR',
          decimals: 24,
          blockchain: 'near',
        },
      ],
    });

    expect(tokens.map(token => token.assetId)).toContain('near:native');
    expect(tokens.map(token => token.assetId)).toContain('nep141:wrap.near');
    expect(tokens.map(token => token.assetId)).toContain(
      'nep141:public-near.near'
    );
  });

  it('does not synthesize a duplicate when the API provides canonical native NEAR', () => {
    let tokens: ExchangeToken[] = [];
    service.loadAssets().subscribe(result => (tokens = result));

    httpMock.expectOne(`${environment.apiUrl}/api/v1/assets`).flush({
      data: [
        {
          assetId: 'near:native',
          defuseAssetId: 'nep141:wrap.near',
          symbol: 'NEAR',
          decimals: 24,
          blockchain: 'near',
        },
        {
          assetId: 'nep141:wrap.near',
          defuseAssetId: 'nep141:wrap.near',
          symbol: 'wNEAR',
          decimals: 24,
          blockchain: 'near',
        },
      ],
    });

    expect(tokens.filter(token => token.assetId === 'near:native').length).toBe(
      1
    );
    expect(tokens.map(token => token.assetId)).toContain('nep141:wrap.near');
  });
});
