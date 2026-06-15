import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, of } from 'rxjs';
import { SwapFlowFacade } from '@domains/exchange/application/swap-flow.facade';
import {
  SwapFlowError,
  SwapFlowState,
  SwapQuotePreview,
} from '@domains/exchange/models/swap.models';
import { WalletAccount } from '@domains/wallet/models/wallet.models';
import { ExchangeToken } from '@shared/models/exchange-token.model';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { ExchangeAssetsService } from '@shared/services/exchange-assets.service';
import { environment } from '../../../environments/environment';
import { HomeComponent } from './home.component';

class WalletsServiceStub {
  public account = new BehaviorSubject<WalletAccount | undefined>(undefined);
}

class SwapFlowFacadeStub {
  private readonly stateSubject = new BehaviorSubject<SwapFlowState>('idle');
  private readonly quotePreviewSubject = new BehaviorSubject<
    SwapQuotePreview | undefined
  >(undefined);
  private readonly errorSubject = new BehaviorSubject<
    SwapFlowError | undefined
  >(undefined);
  private readonly intentHashSubject = new BehaviorSubject<string | undefined>(
    undefined
  );

  public readonly state$ = this.stateSubject.asObservable();
  public readonly quotePreview$ = this.quotePreviewSubject.asObservable();
  public readonly error$ = this.errorSubject.asObservable();
  public readonly intentHash$ = this.intentHashSubject.asObservable();
  public readonly quotePreview: SwapQuotePreview | undefined = undefined;

  public reset(): void {
    this.quotePreviewSubject.next(undefined);
    this.errorSubject.next(undefined);
    this.intentHashSubject.next(undefined);
    this.stateSubject.next('idle');
  }
}

class ExchangeAssetsServiceStub {
  public loadAssets() {
    return of<ExchangeToken[]>([]);
  }
}

describe('HomeComponent market overview', () => {
  let component: HomeComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, HttpClientTestingModule],
      declarations: [HomeComponent],
      providers: [
        { provide: WalletsService, useClass: WalletsServiceStub },
        { provide: SwapFlowFacade, useClass: SwapFlowFacadeStub },
        { provide: ExchangeAssetsService, useClass: ExchangeAssetsServiceStub },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    component = TestBed.createComponent(HomeComponent).componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests comparison data with backend-supported symbols and timeframes', () => {
    expect(component.comparisonTimeframes).toEqual(['1H', '1D', '1W']);

    const initialRequest = expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    });
    initialRequest.flush(comparisonResponse('USDC', 'NEAR', '1H'));

    expect(component.comparisonError).toBe('');
    expect(component.comparisonLines.length).toBe(1);
    expect(component.comparisonLines[0].symbol).toBe('NEAR-USDC');
    expect(component.comparisonYLabels.map(label => label.label)).toContain(
      '0%'
    );
  });

  it('uses display symbols for wrapped assets when the timeframe changes', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    component.toToken = {
      assetId: 'nep141:btc.omft.near',
      symbol: 'wBTC',
      displaySymbol: 'BTC',
      name: 'Wrapped Bitcoin',
      color: '#f7931a',
    };

    component.changeComparisonTimeframe('1D');

    expectComparisonRequest({
      base: 'USDC',
      quote: 'BTC',
      timeframe: '1D',
    }).flush(comparisonResponse('USDC', 'BTC', '1D'));
  });

  it('shows an unavailable state when there is not enough data to render a spread', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush({
      ...comparisonResponse('USDC', 'NEAR', '1H'),
      status: 'ready',
      series: [
        {
          symbol: 'USDC',
          points: [{ time: 1_700_000_000, value: 100 }],
        },
        {
          symbol: 'NEAR',
          points: [{ time: 1_700_000_000, value: 100 }],
        },
      ],
    });

    expect(component.comparisonLines).toEqual([]);
    expect(component.comparisonError).toBe('Comparison data unavailable');
  });

  function expectComparisonRequest(expected: {
    base: string;
    quote: string;
    timeframe: string;
  }) {
    const request = httpMock.expectOne(req => {
      return (
        req.url === `${environment.apiUrl}/api/v1/markets/comparison` &&
        req.params.get('base') === expected.base &&
        req.params.get('quote') === expected.quote &&
        req.params.get('timeframe') === expected.timeframe
      );
    });

    expect(request.request.method).toBe('GET');
    return request;
  }

  function comparisonResponse(
    base: string,
    quote: string,
    timeframe: '1H' | '1D' | '1W'
  ) {
    return {
      base,
      quote,
      timeframe,
      status: 'ready',
      baseToken: {
        symbol: base,
        currentPrice: 1,
        changePercent: 1.2,
        historyAvailable: true,
      },
      quoteToken: {
        symbol: quote,
        currentPrice: 4,
        changePercent: 3.4,
        historyAvailable: true,
      },
      relativeStrength: -2.2,
      series: [
        {
          symbol: base,
          points: [
            { time: 1_700_000_000, value: 100 },
            { time: 1_700_003_600, value: 101.2 },
          ],
        },
        {
          symbol: quote,
          points: [
            { time: 1_700_000_000, value: 100 },
            { time: 1_700_003_600, value: 103.4 },
          ],
        },
      ],
    };
  }
});
