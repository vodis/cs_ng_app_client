import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
        assetId:
          'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
        symbol: 'USDC',
        displaySymbol: 'USDC',
        name: 'USD Coin',
        icon: undefined,
        decimals: 6,
        color: '#2f8cff',
      },
      {
        assetId: 'nep141:wrap.near',
        symbol: 'wNEAR',
        displaySymbol: 'NEAR',
        name: 'NEAR Protocol',
        icon: 'https://example.com/near.png',
        decimals: 24,
        color: '#2fd17c',
      },
    ]);
  });
});
