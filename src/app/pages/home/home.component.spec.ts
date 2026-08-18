import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, Subject, of } from 'rxjs';
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
import {
  WalletBalance,
  WalletBalancesService,
} from '@shared/services/wallet-balances.service';
import { environment } from '../../../environments/environment';
import { HomeComponent } from './home.component';

class WalletsServiceStub {
  public account = new BehaviorSubject<WalletAccount | undefined>(undefined);
  public requestOpen = jasmine.createSpy('requestOpen');
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

  public watchQuotePreview = jasmine.createSpy('watchQuotePreview');

  public refreshQuotePreview(): void {
    return undefined;
  }

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

class WalletBalancesServiceStub {
  public balances: WalletBalance[] = [];
  public balancesSubject?: Subject<WalletBalance[]>;
  public calls: Array<{
    walletAddress?: string;
    network?: string;
    assetId?: string;
  }> = [];

  public loadBalances(params?: {
    walletAddress?: string;
    network?: string;
    assetId?: string;
  }) {
    this.calls.push(params ?? {});
    return this.balancesSubject ?? of(this.balances);
  }
}

describe('HomeComponent market overview', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, HttpClientTestingModule],
      declarations: [HomeComponent],
      providers: [
        { provide: WalletsService, useClass: WalletsServiceStub },
        { provide: SwapFlowFacade, useClass: SwapFlowFacadeStub },
        { provide: ExchangeAssetsService, useClass: ExchangeAssetsServiceStub },
        { provide: WalletBalancesService, useClass: WalletBalancesServiceStub },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
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
    expect(component.comparisonChartSeries.length).toBe(2);
    expect(component.comparisonChartSeries.map(line => line.id)).toEqual([
      'USDC',
      'NEAR',
    ]);
    expect(component.selectedMarketChartMode).toBe('price');
    expect(component.comparisonChartSeries[0].points[0].value).toBe(0);

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.chart__empty')).toBeNull();
    expect(compiled.querySelector('app-market-overview-chart')).toBeTruthy();
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
      blockchain: 'near',
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

    expect(component.comparisonChartSeries).toEqual([]);
    expect(component.comparisonError).toBe('Comparison data unavailable');

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.chart__empty')?.textContent?.trim()).toBe(
      'Comparison data unavailable'
    );
    expect(compiled.querySelector('app-market-overview-chart')).toBeNull();
  });

  it('shows relative chart baseline when switching to relative mode', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    expect(component.marketSummaryHeadline()).toContain('1 USDC =');
    expect(component.marketSummaryChangeText()).toBe('+3.40% (1H)');

    component.changeMarketChartMode('relative');

    expect(component.selectedMarketChartMode).toBe('relative');
    expect(component.comparisonChartSeries.length).toBe(1);
    expect(component.comparisonChartSeries[0].id).toBe('NEAR-USDC');
    expect(component.comparisonChartSeries[0].points[0].value).toBe(0);
    expect(component.marketSummaryHeadline()).toBe('NEAR +2.20% vs USDC');
    expect(component.marketSummaryChangeText()).toBe(
      'USDC +1.20% · NEAR +3.40% (1H)'
    );
  });

  it('uses base/quote direction for fallback swap rate', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    component.amount = '1';
    component.quoteResult = undefined;
    component.fromToken = {
      ...component.fromToken,
      symbol: 'NEAR',
      displaySymbol: 'NEAR',
    };
    component.toToken = {
      ...component.toToken,
      symbol: 'ETH',
      displaySymbol: 'ETH',
    };
    component.changeComparisonTimeframe('1D');
    expectComparisonRequest({
      base: 'NEAR',
      quote: 'ETH',
      timeframe: '1D',
    }).flush(comparisonResponse('NEAR', 'ETH', '1D'));

    const rate = component['previewSwapRate']();
    expect(rate).toBeCloseTo(1 / 4, 8);
  });

  it('normalizes integer quote amount using destination decimals', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    component.toToken = {
      ...component.toToken,
      symbol: 'ETH',
      decimals: 6,
      blockchain: 'eth',
    };
    component.quoteResult = { amountOut: '7385926' };

    expect(component.toAmountDisplay()).toBe('7.385926');
  });

  it('normalizes NEAR quote raw amount using 24 destination decimals', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    component.toToken = {
      ...component.toToken,
      decimals: 24,
    };
    component.quoteResult = {
      quote: {
        amountOut: '450318543814579873646208',
      },
    };

    expect(component.toAmountDisplay()).toBe('0.450318543814579873646208');
    expect(component.toAmountFormatted()).toBe('0,4503');
  });

  it('shows live NEAR balance for the connected NEAR wallet', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    balancesService.balances = [
      {
        walletId: 'wallet-1',
        walletAddress: 'alice.near',
        chainType: 'near',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '1250000000000000000000000',
        balanceDecimal: '1.25',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
      },
    ];
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next({ account: 'alice.near', chainId: null });

    expect(component.balanceLabel('NEAR')).toBe('Balance: 1,25 NEAR');
  });

  it('blocks NEAR quotes when entered amount exceeds live balance', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    balancesService.balances = [
      {
        walletId: 'wallet-1',
        walletAddress: 'alice.near',
        chainType: 'near',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '1000000000000000000000000',
        balanceDecimal: '1',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
      },
    ];
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next({ account: 'alice.near', chainId: null });
    component.fromToken = {
      ...component.fromToken,
      symbol: 'NEAR',
      decimals: 24,
    };
    component.amount = '2';

    component.submitQuote();

    expect(component.quoteError).toBe('Insufficient NEAR balance.');
  });

  it('uses the testnet balance network for a .testnet wallet', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next({ account: 'alice.testnet', chainId: null });

    expect(balancesService.calls).toEqual([
      {
        walletAddress: 'alice.testnet',
        network: 'near:testnet',
      },
    ]);
  });

  it('uses a confirmed foreign-network recipient in quote previews', () => {
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next({
      account: '0x0000000000000000000000000000000000000001',
      chainId: 1,
    });
    component.toToken = {
      assetId: 'nep141:sol-usdc.omft.near',
      symbol: 'USDC',
      name: 'USD Coin',
      color: '#2f8cff',
      decimals: 6,
      blockchain: 'sol',
    };
    component.amount = '1';
    component.saveRecipientAddress(
      'BYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z'
    );

    expect(component.isForeignDestination()).toBeTrue();
    expect(swapFlowFacade.watchQuotePreview).toHaveBeenCalledWith(
      jasmine.objectContaining({
        signerId: '0x0000000000000000000000000000000000000001',
        recipient: 'BYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z',
        recipientType: 'DESTINATION_CHAIN',
      })
    );
  });

  it('retries the quote preview after an asynchronous balance load', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    balancesService.balancesSubject = new Subject<WalletBalance[]>();

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    component.fromToken = {
      ...component.toToken,
      symbol: 'NEAR',
      decimals: 24,
    };
    component.toToken = {
      assetId:
        'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
      symbol: 'USDC',
      name: 'USD Coin',
      color: '#2f8cff',
      decimals: 6,
      blockchain: 'eth',
    };
    component.amount = '1';
    walletsService.account.next({ account: 'alice.near', chainId: null });
    component.recipientAddress = '0x0000000000000000000000000000000000000002';

    expect(swapFlowFacade.watchQuotePreview).toHaveBeenCalledWith(undefined);

    balancesService.balancesSubject.next([
      {
        walletId: 'wallet-1',
        walletAddress: 'alice.near',
        chainType: 'near',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '2000000000000000000000000',
        balanceDecimal: '2',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
      },
    ]);

    expect(swapFlowFacade.watchQuotePreview).toHaveBeenCalledWith(
      jasmine.objectContaining({
        amount: '1000000000000000000000000',
        signerId: 'alice.near',
        recipient: '0x0000000000000000000000000000000000000002',
        recipientType: 'DESTINATION_CHAIN',
      })
    );
  });

  it('reloads an expired balance before allowing a NEAR quote', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    balancesService.balances = [
      {
        walletId: 'wallet-1',
        walletAddress: 'alice.near',
        chainType: 'near',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '2000000000000000000000000',
        balanceDecimal: '2',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2026-08-12T12:00:15.000Z',
      },
    ];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next({ account: 'alice.near', chainId: null });
    component.fromToken = {
      ...component.toToken,
      symbol: 'NEAR',
      decimals: 24,
    };
    component.amount = '1';

    component.submitQuote();

    expect(balancesService.calls.length).toBe(2);
    expect(component.quoteError).toBe('NEAR balance is loading.');
  });

  it('prefers backend formatted quote amount from nested quote response', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    component.toToken = {
      ...component.toToken,
      decimals: 24,
    };
    component.amount = '100';
    component.quoteResult = {
      quote: {
        amountOut: '450318543814579873646208',
        amountOutFormatted: '0.450318543814579873646208',
      },
    };

    expect(component.toAmountDisplay()).toBe('0.450318543814579873646208');
    expect(component.swapRateLabel()).toBe('1 USDC ≈ 0,0045 NEAR');
  });

  describe('amount input formatting', () => {
    beforeEach(() => {
      expectComparisonRequest({
        base: 'USDC',
        quote: 'NEAR',
        timeframe: '1H',
      }).flush(comparisonResponse('USDC', 'NEAR', '1H'));
    });

    it('formats stored amount for display with comma decimals', () => {
      component.amount = '0.886767';
      expect(component.fromAmountDisplay()).toBe('0,886767');
    });

    it('formats large stored amounts with thousand dots', () => {
      component.amount = '10000000000.1000';
      expect(component.fromAmountDisplay()).toBe('10.000.000.000,1000');
    });

    it('sanitizes grouped display input into dot-decimal storage', () => {
      const input = document.createElement('input');
      input.value = '1.250,5';

      component.onAmountInput({ target: input } as unknown as Event);

      expect(component.amount).toBe('1250.5');
      expect(input.value).toBe('1.250,5');
    });

    it('supports entering fractional digits beyond six places', () => {
      component.amount = '0.8867671234';
      expect(component.fromAmountDisplay()).toBe('0,8867671234');
    });

    it('keeps the current amount when the input is focused', () => {
      component.amount = '0.886767';
      const input = document.createElement('input');

      component.onAmountFocus({ target: input } as unknown as FocusEvent);

      expect(component.amount).toBe('0.886767');
      expect(input.value).toBe('0,886767');
    });

    it('inserts comma from physical Comma key regardless of keyboard layout', () => {
      const input = document.createElement('input');
      input.value = '0';
      input.setSelectionRange(1, 1);

      const preventDefault = jasmine.createSpy('preventDefault');
      component.onAmountKeydown({
        key: 'б',
        code: 'Comma',
        preventDefault,
        target: input,
      } as unknown as KeyboardEvent);

      expect(preventDefault).toHaveBeenCalled();
      expect(component.amount).toBe('0.');
      expect(input.value).toBe('0,');
      expect(input.selectionStart).toBe(2);
    });

    it('places caret after comma so 0,1 can be entered', () => {
      const input = document.createElement('input');
      input.value = '0';
      input.setSelectionRange(1, 1);

      component.onAmountKeydown({
        key: 'б',
        code: 'Comma',
        preventDefault: jasmine.createSpy('preventDefault'),
        target: input,
      } as unknown as KeyboardEvent);

      input.value = '0,1';
      component.onAmountInput({ target: input } as unknown as Event);

      expect(component.amount).toBe('0.1');
      expect(input.value).toBe('0,1');
    });
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

  it('opens wallet connector when connect wallet is submitted without a session', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;

    component.submitQuote();

    expect(walletsService.requestOpen).toHaveBeenCalled();
    expect(component.quoteError).toBe('');
  });
});
