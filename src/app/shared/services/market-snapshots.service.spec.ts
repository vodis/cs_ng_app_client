import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { MarketSnapshotsService } from './market-snapshots.service';

describe('MarketSnapshotsService', () => {
  let httpMock: HttpTestingController;
  let service: MarketSnapshotsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MarketSnapshotsService],
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(MarketSnapshotsService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads snapshots for the requested symbols', () => {
    let result: unknown;
    service.load(['near', 'BTC']).subscribe(snapshots => {
      result = snapshots;
    });

    const request = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/markets/snapshots?symbols=NEAR,BTC`
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      data: [
        {
          symbol: 'NEAR',
          priceUsd: 5.1,
          change24hPercent: 3.42,
          marketCapUsd: 6_100_000_000,
          volume24hUsd: 312_000_000,
          sparkline7d: [4.8, 5.1],
        },
      ],
    });

    expect(result).toEqual([
      {
        symbol: 'NEAR',
        priceUsd: 5.1,
        change24hPercent: 3.42,
        marketCapUsd: 6_100_000_000,
        volume24hUsd: 312_000_000,
        sparkline7d: [4.8, 5.1],
      },
      {
        symbol: 'BTC',
        priceUsd: 0,
        change24hPercent: 0,
        marketCapUsd: 0,
        volume24hUsd: 0,
        sparkline7d: [0, 0],
      },
    ]);
  });

  it('returns zeros when the snapshot request fails', () => {
    let result: unknown;
    service.load(['USDT']).subscribe(snapshots => {
      result = snapshots;
    });

    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/markets/snapshots?symbols=USDT`)
      .flush('unavailable', { status: 503, statusText: 'Service Unavailable' });

    expect(result).toEqual([
      {
        symbol: 'USDT',
        priceUsd: 0,
        change24hPercent: 0,
        marketCapUsd: 0,
        volume24hUsd: 0,
        sparkline7d: [0, 0],
      },
    ]);
  });
});
