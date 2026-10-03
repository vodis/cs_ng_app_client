import { nearNetworkForAddress } from '@shared/utils/network.utils';
import {
  ActiveWalletFacade,
  type ActiveWalletState,
} from '@domains/wallet/application/active-wallet.facade';
import { ConnectedWalletBalancesFacade } from '@domains/wallet/application/connected-wallet-balances.facade';
import { Injectable, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import {
  BehaviorSubject,
  Subject,
  map,
  of,
  combineLatest,
  switchMap,
  shareReplay,
} from 'rxjs';
import { SwapFlowFacade } from '@domains/exchange/application/swap-flow.facade';
import {
  SwapFlowError,
  SwapFlowState,
  SwapQuotePreview,
} from '@domains/exchange/models/swap.models';
import { WalletAccount } from '@domains/wallet/models/wallet.models';
import { ExchangeToken } from '@shared/models/exchange-token.model';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { ExchangeAssetsService } from '@shared/services/exchange-assets.service';
import {
  WalletBalance,
  WalletBalancesService,
} from '@shared/services/wallet-balances.service';
import { environment } from '../../../environments/environment';
import { HomeComponent } from './home.component';

class WalletsServiceStub {
  public swapSettled = new Subject<{
    traceId: string;
    status: 'SUCCESS' | 'REFUNDED' | 'FAILED' | 'INCOMPLETE_DEPOSIT';
  }>();
  public account = new BehaviorSubject<WalletAccount | undefined>(undefined);
  public swapSubmitted = new BehaviorSubject<
    { traceId: string; intentHash: string } | undefined
  >(undefined);
  public swapPreviewRefreshRequested = new BehaviorSubject<string | undefined>(
    undefined
  );
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

  public refreshQuotePreview = jasmine.createSpy('refreshQuotePreview');

  public emitError(error: SwapFlowError): void {
    this.quotePreviewSubject.next(undefined);
    this.errorSubject.next(error);
    this.stateSubject.next('idle');
  }

  public emitQuote(preview: SwapQuotePreview): void {
    this.quotePreviewSubject.next(preview);
    this.stateSubject.next('idle');
  }

  public reset(): void {
    this.quotePreviewSubject.next(undefined);
    this.errorSubject.next(undefined);
    this.intentHashSubject.next(undefined);
    this.stateSubject.next('idle');
  }
}

class ExchangeAssetsServiceStub {
  public tokens: ExchangeToken[] = [];

  public loadAssets() {
    return of(this.tokens);
  }
}

class WalletBalancesServiceStub {
  public balances: WalletBalance[] = [];
  public balancesSubject?: Subject<WalletBalance[]>;
  public calls: Array<{
    walletAddress?: string;
    network?: string;
    assetId?: string;
    assetIds?: string[];
  }> = [];

  public loadBalances(params?: {
    walletAddress?: string;
    network?: string;
    assetId?: string;
    assetIds?: string[];
  }) {
    this.calls.push(params ?? {});
    return this.balancesSubject ?? of(this.balances);
  }

  public loadBalancesWithMeta(params?: {
    walletAddress?: string;
    network?: string;
    assetId?: string;
    assetIds?: string[];
  }) {
    this.calls.push(params ?? {});
    if (this.balancesSubject) {
      return this.balancesSubject.pipe(
        map(balances => ({ balances, partial: false }))
      );
    }
    return of({ balances: this.balances, partial: false });
  }
}

@Injectable()
class ActiveWalletStub {
  private refresh = new BehaviorSubject(0);
  readonly state$ = this.wallets.account.pipe(
    map(account => {
      const state: ActiveWalletState = {
        userId: 'user',
        sessionId: 'session',
        connected: Boolean(account),
        canSign: Boolean(account),
        reason: account ? '' : 'Connect wallet',
        wallet: account
          ? {
              id: account.account,
              address: account.account,
              chainType:
                account.identity?.chainType ??
                (account.account.startsWith('0x') ? 'ethereum' : 'near'),
              walletType: 'external',
              providerWalletId: '',
              isPrimary: true,
            }
          : undefined,
        snapshot: account
          ? {
              status: 'connected',
              account: account.account,
              chainId: account.chainId,
              isVerified: true,
              safetyStatus: 'safe',
              isBypassed: false,
              executionState: 'operating.idle',
            }
          : undefined,
        network: account
          ? account.account.startsWith('0x')
            ? `eip155:${account.chainId}`
            : nearNetworkForAddress(account.account)
          : undefined,
      };
      return state;
    })
  );
  readonly balances$ = combineLatest([this.state$, this.refresh]).pipe(
    switchMap(([state]) =>
      state.wallet && state.network
        ? this.balances.load({
            account: state.wallet.address,
            network: state.network,
          })
        : of({ status: 'idle', rows: [] })
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  constructor(
    private wallets: WalletsService,
    private balances: ConnectedWalletBalancesFacade
  ) {
    this.wallets.swapSettled.subscribe(() => this.refreshBalances());
  }
  refreshBalances() {
    this.refresh.next(this.refresh.value + 1);
  }
  requestConnection() {
    this.wallets.requestOpen();
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
        { provide: ActiveWalletFacade, useClass: ActiveWalletStub },
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

  it('does not scale an already formatted whole-token quote a second time', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));
    component.toToken = { ...component.toToken, decimals: 6 };
    component.quoteResult = {
      quote: { amountOut: '1000000', amountOutFormatted: '1' },
    };
    expect(component.toAmountDisplay()).toBe('1');
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

  it('labels the connected-wallet action Review before any signing starts', () => {
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    expect(component.primaryActionLabel()).toBe('Connect wallet');
    walletsService.account.next({
      account: 'alice.near',
      chainId: null,
      identity: {
        connectorId: 'near',
        address: 'alice.near',
        chainType: 'near',
        walletType: 'external',
      },
    });

    expect(component.primaryActionLabel()).toBe('Review');
    expect(component.canReviewSwap()).toBeFalse();
  });

  it('uses 0.5% as the default quote slippage', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    balancesService.balances = [nearBalance()];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next(nearWallet());
    component.amount = '1';
    component['refreshSwapQuotePreview']();

    expect(component.slippageLabel()).toBe('0.5%');
    expect(swapFlowFacade.watchQuotePreview).toHaveBeenCalledWith(
      jasmine.objectContaining({ slippageToleranceBps: 50 })
    );
  });

  it('applies a saved slippage preset to later quote requests', () => {
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

    walletsService.account.next(nearWallet());
    component.amount = '1';
    component.saveSlippageSettings(100);

    expect(component.slippageLabel()).toBe('1%');
    expect(component.isSlippageSettingsOpen).toBeFalse();
    expect(swapFlowFacade.watchQuotePreview).toHaveBeenCalledWith(
      jasmine.objectContaining({ slippageToleranceBps: 100 })
    );
  });

  it('routes native NEAR from the wallet and preserves 24/6 decimal amounts (Sep 30 swap)', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));
    component.walletAddress = 'vodis_craftscript.tg';
    component.fromToken = {
      ...component.toToken,
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      decimals: 24,
      blockchain: 'near',
    };
    const amount = component['toBaseUnits']('0.01', 24);
    expect(amount).toBe('10000000000000000000000');
    expect(component['fromBaseUnits']('50446', 6)).toBe('0.050446');
    expect(component['buildSwapInput'](amount)).toEqual(
      jasmine.objectContaining({
        source: jasmine.objectContaining({
          executionAssetId: 'nep141:wrap.near',
        }),
        amount,
        recipient: 'vodis_craftscript.tg',
        slippageToleranceBps: 50,
      })
    );
    const input = component['buildSwapInput'](amount);
    expect(Object.keys(input)).not.toContain('depositType');
    expect(Object.keys(input)).not.toContain('authMethod');
    expect(Object.keys(input)).not.toContain('deadline');
  });

  it('passes privacy choices without selecting funding channels', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    component.walletAddress = 'alice.near';
    component.fromToken = {
      assetId: 'nep141:usdc.near',
      symbol: 'USDC',
      name: 'USD Coin',
      color: '#2f8cff',
      decimals: 6,
      blockchain: 'near',
    };
    component.toToken = {
      assetId: 'nep141:wrap.near',
      symbol: 'wNEAR',
      name: 'Wrapped NEAR',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };

    expect(component['buildSwapInput']('1000000')).toEqual(
      jasmine.objectContaining({ confidential: false })
    );

    component.setConfidentialSwap(true);
    expect(component['buildSwapInput']('1000000')).toEqual(
      jasmine.objectContaining({ confidential: true })
    );
  });

  it('enables a manual quote retry after a quote request fails', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    balancesService.balances = [nearBalance()];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next(nearWallet());
    component.fromToken = { ...component.toToken };
    component.amount = '1';
    component['refreshSwapQuotePreview']();
    swapFlowFacade.emitError({
      code: 'QUOTE_FAILED',
      message: 'Quote failed. Try again.',
      retryable: true,
      step: 'requestingQuote',
    });

    expect(component.canReviewSwap()).toBeFalse();
    expect(component.canRetryQuote()).toBeTrue();
    expect(component.isPrimaryActionDisabled()).toBeFalse();
    expect(component.primaryActionLabel()).toBe('Retry quote');

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const action = compiled.querySelector<HTMLButtonElement>('.connectMain');
    expect(compiled.querySelector('.exchange-error')?.textContent?.trim()).toBe(
      'Quote failed. Try again.'
    );
    expect(action?.disabled).toBeFalse();
    expect(action?.textContent?.trim()).toBe('RETRY QUOTE');

    component.submitQuote();

    expect(swapFlowFacade.refreshQuotePreview).toHaveBeenCalledWith(
      jasmine.objectContaining({ slippageToleranceBps: 50 })
    );
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
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '1250000000000000000000000',
        balanceDecimal: '1.25',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: false,
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

    expect(component.balanceLabel(component.toToken)).toBe(
      'Balance: 1,25 NEAR'
    );
  });

  it('fills only the From amount when From balance is clicked', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    balancesService.balances = [
      {
        walletId: 'wallet-1',
        walletAddress: 'alice.near',
        chainType: 'near',
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '1250000000000000000000000',
        balanceDecimal: '1.25',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: false,
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
      assetId: 'near:native',
      symbol: 'NEAR',
      decimals: 24,
    };
    component.toToken = {
      ...component.fromToken,
      assetId: 'nep141:usdc.near',
      symbol: 'USDC',
      decimals: 6,
    };
    component.toAmountManual = '9';

    expect(component.canApplyMaxBalance(component.fromToken)).toBeTrue();
    component.applyMaxBalance('from');

    expect(component.amount).toBe('1.25');
    expect(component.toAmountManual).toBe('');
    expect(swapFlowFacade.watchQuotePreview).toHaveBeenCalled();
  });

  it('fills only the To amount when To balance is clicked', () => {
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
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '2000000000000000000000000',
        balanceDecimal: '2',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: false,
      },
    ];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next({ account: 'alice.near', chainId: null });
    component.amount = '0.5';

    expect(component.canApplyMaxBalance(component.toToken)).toBeTrue();
    component.applyMaxBalance('to');

    expect(component.amount).toBe('0.5');
    expect(component.toAmountManual).toBe('2');
    expect(component.toAmountFormatted()).toContain('2');
  });

  it('preserves canonical decimals when From balance is clicked', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
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

    walletsService.account.next({ account: 'alice.near', chainId: null });
    component.fromToken = {
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };
    component.toToken = {
      assetId: 'nep141:usdc.near',
      symbol: 'USDC',
      name: 'USD Coin',
      color: '#2f8cff',
      decimals: 6,
      blockchain: 'near',
    };

    const cases: Array<{
      balanceRaw: string;
      balanceDecimal: string | null;
      expectedAmount: string;
    }> = [
      {
        balanceRaw: '1000000000000000000000000',
        balanceDecimal: '1',
        expectedAmount: '1',
      },
      {
        balanceRaw: '1234000000000000000000000',
        balanceDecimal: null,
        expectedAmount: '1.234',
      },
      {
        balanceRaw: '1000000000000000000000',
        balanceDecimal: null,
        expectedAmount: '0.001',
      },
      {
        balanceRaw: '1123456789012345678901234',
        balanceDecimal: null,
        expectedAmount: '1.123456789012345678901234',
      },
    ];

    for (const testCase of cases) {
      const balance: WalletBalance = {
        walletId: 'wallet-1',
        walletAddress: 'alice.near',
        chainType: 'near',
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: testCase.balanceRaw,
        balanceDecimal: testCase.balanceDecimal,
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: false,
      };
      balancesService.balances = [balance];
      (
        component as unknown as { walletBalances: WalletBalance[] }
      ).walletBalances = [balance];
      swapFlowFacade.watchQuotePreview.calls.reset();

      component.applyMaxBalance('from');

      expect(component.amount)
        .withContext(`raw=${testCase.balanceRaw}`)
        .toBe(testCase.expectedAmount);
      expect(swapFlowFacade.watchQuotePreview).toHaveBeenCalledWith(
        jasmine.objectContaining({ amount: testCase.balanceRaw })
      );
    }
  });

  it('preserves canonical decimals when To balance is clicked', () => {
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

    walletsService.account.next({ account: 'alice.near', chainId: null });
    component.amount = '1';

    const cases: Array<{
      balanceRaw: string;
      balanceDecimal: string | null;
      expectedAmount: string;
    }> = [
      {
        balanceRaw: '1000000000000000000000000',
        balanceDecimal: '1',
        expectedAmount: '1',
      },
      {
        balanceRaw: '1234000000000000000000000',
        balanceDecimal: null,
        expectedAmount: '1.234',
      },
      {
        balanceRaw: '1000000000000000000000',
        balanceDecimal: null,
        expectedAmount: '0.001',
      },
      {
        balanceRaw: '1123456789012345678901234',
        balanceDecimal: null,
        expectedAmount: '1.123456789012345678901234',
      },
    ];

    for (const testCase of cases) {
      const balance: WalletBalance = {
        walletId: 'wallet-1',
        walletAddress: 'alice.near',
        chainType: 'near',
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: testCase.balanceRaw,
        balanceDecimal: testCase.balanceDecimal,
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: false,
      };
      balancesService.balances = [balance];
      (
        component as unknown as { walletBalances: WalletBalance[] }
      ).walletBalances = [balance];
      component.quotePreview = {
        amountOutAtomic: testCase.balanceRaw,
        amountOut: testCase.balanceRaw,
        expiresAt: '2099-01-01T00:00:00.000Z',
        traceId: 'trace-to-max',
        raw: { amountOut: testCase.balanceRaw },
      };
      component.quoteResult = {
        amountOut: testCase.balanceRaw,
        amountOutAtomic: testCase.balanceRaw,
      };

      component.applyMaxBalance('to');

      expect(component.toAmountManual)
        .withContext(`raw=${testCase.balanceRaw}`)
        .toBe(testCase.expectedAmount);
      expect(
        (
          component as unknown as {
            destinationTargetMatchesQuote: () => boolean;
          }
        ).destinationTargetMatchesQuote()
      )
        .withContext(`match raw=${testCase.balanceRaw}`)
        .toBeTrue();
      expect(
        (
          component as unknown as {
            toBaseUnits: (value: string, decimals?: number) => string;
          }
        ).toBaseUnits(component.toAmountManual, component.toToken.decimals)
      )
        .withContext(`atomic raw=${testCase.balanceRaw}`)
        .toBe(testCase.balanceRaw);
    }
  });

  it('keeps Review disabled when To balance override mismatches the quote', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    balancesService.balances = [nearBalance()];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next(nearWallet());
    component.fromToken = {
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };
    component.toToken = {
      assetId: 'nep141:usdc.near',
      symbol: 'USDC',
      name: 'USD Coin',
      color: '#2f8cff',
      decimals: 6,
      blockchain: 'near',
    };
    component.amount = '1';
    component.toAmountManual = '9';
    swapFlowFacade.emitQuote({
      amountOut: '1000000',
      amountOutAtomic: '1000000',
      expiresAt: '2099-01-01T00:00:00.000Z',
      traceId: 'trace-mismatch',
      raw: { amountOut: '1000000' },
    });

    expect(component.toAmountDisplay()).toBe('9');
    expect(component.quotedToAmountDisplay()).toBe('1');
    expect(component.canReviewSwap()).toBeFalse();
    expect(component.isPrimaryActionDisabled()).toBeTrue();
  });

  it('enables Review only when the To target matches the quoted output', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    balancesService.balances = [nearBalance()];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next(nearWallet());
    component.fromToken = {
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };
    component.toToken = {
      assetId: 'nep141:usdc.near',
      symbol: 'USDC',
      name: 'USD Coin',
      color: '#2f8cff',
      decimals: 6,
      blockchain: 'near',
    };
    component.amount = '1';
    component.toAmountManual = '1';
    swapFlowFacade.emitQuote({
      amountOut: '1000000',
      amountOutAtomic: '1000000',
      expiresAt: '2099-01-01T00:00:00.000Z',
      traceId: 'trace-match',
      raw: { amountOut: '1000000' },
    });

    expect(component.canReviewSwap()).toBeTrue();
    component.activeWallet = {
      ...component.activeWallet,
      canSign: false,
      reason: 'Verify the active wallet before signing.',
    };
    expect(component.canReviewSwap()).toBeFalse();
    expect(component.reviewBlockingReason()).toContain('Verify');
    component.activeWallet = {
      ...component.activeWallet,
      canSign: true,
      reason: '',
    };
    if (!component.quotePreview) throw new Error('Missing quote fixture');
    const validPreview = component.quotePreview;
    component.quotePreview = { ...validPreview, expiresAt: 'invalid' };
    expect(component.canReviewSwap()).toBeFalse();
    expect(component.reviewBlockingReason()).toContain('expired');
    expect(component.canRetryQuote()).toBeTrue();
    component.quotePreview = validPreview;
    expect(component.canReviewSwap()).toBeTrue();

    swapFlowFacade.emitQuote({
      amountOut: '1',
      amountOutAtomic: '1000000',
      expiresAt: '2099-01-01T00:00:00.000Z',
      raw: {},
      action: {
        supported: false,
        label: 'Swap unavailable',
        description: 'Choose a supported source asset.',
      },
    });
    expect(component.canReviewSwap()).toBeFalse();
    expect(component.primaryActionLabel()).toBe('Swap unavailable');
    expect(component.fundingSourceError()).toBe(
      'Choose a supported source asset.'
    );
  });

  it('opens Review with quoted amountOutDisplay, never the To override', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    const walletGateway = TestBed.inject(WalletGatewayBridgeService);
    const openReview = spyOn(walletGateway, 'openSwapReview');
    balancesService.balances = [nearBalance()];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next(nearWallet());
    component.fromToken = {
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };
    component.toToken = {
      assetId: 'nep141:usdc.near',
      symbol: 'USDC',
      name: 'USD Coin',
      color: '#2f8cff',
      decimals: 6,
      blockchain: 'near',
    };
    component.amount = '1';
    component.toAmountManual = '1';
    swapFlowFacade.emitQuote({
      amountOut: '1000000',
      amountOutAtomic: '1000000',
      expiresAt: '2099-01-01T00:00:00.000Z',
      traceId: 'trace-quoted-display',
      raw: { amountOut: '1000000' },
    });

    expect(component.canReviewSwap()).toBeTrue();
    component.submitQuote();

    expect(openReview).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        traceId: 'trace-quoted-display',
        preview: jasmine.objectContaining({
          amountOutAtomic: '1000000',
          amountOutDisplay: '1',
        }),
      })
    );
  });

  it('clears the To balance override when the destination token changes', () => {
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    component.toAmountManual = '9';
    component.tokenSelectorSide = 'to';
    component.handleTokenSelected({
      assetId: 'nep141:usdt.near',
      symbol: 'USDT',
      name: 'Tether USD',
      color: '#26a17b',
      decimals: 6,
      blockchain: 'near',
    });

    expectComparisonRequest({
      base: 'USDC',
      quote: 'USDT',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'USDT', '1H'));

    expect(component.toAmountManual).toBe('');
    expect(component.toToken.assetId).toBe('nep141:usdt.near');
  });

  it('exposes every non-zero connected-network balance to the source selector', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const tokens = Array.from(
      { length: 21 },
      (_, index): ExchangeToken => ({
        assetId: `nep141:token-${index}.near`,
        symbol: index === 20 ? 'ZEC' : `T${index}`,
        name: index === 20 ? 'Zcash' : `Token ${index}`,
        color: '#2fd17c',
        decimals: 8,
        blockchain: 'near',
      })
    );
    component.exchangeTokens = tokens;
    const assetsService = TestBed.inject(
      ExchangeAssetsService
    ) as unknown as ExchangeAssetsServiceStub;
    assetsService.tokens = tokens;
    balancesService.balances = [
      {
        walletId: 'wallet-1',
        walletAddress: 'alice.near',
        chainType: 'near',
        network: 'near:mainnet',
        assetId: tokens[20].assetId,
        symbol: 'ZEC',
        decimals: 8,
        balanceRaw: '100000',
        balanceDecimal: '0.001',
        source: 'near_rpc',
        fetchedAt: '2026-09-17T12:00:00.000Z',
        expiresAt: '2099-09-17T12:00:15.000Z',
        stale: false,
      },
    ];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next({ account: 'alice.near', chainId: null });
    component.openTokenSelector('from');

    const tokenRequests = balancesService.calls.filter(call => call.assetIds);
    expect(tokenRequests.flatMap(call => call.assetIds ?? []).length).toBe(21);
    expect(tokenRequests.flatMap(call => call.assetIds ?? [])).toContain(
      tokens[20].assetId
    );
    expect(component.tokenSelectorWalletTokens()).toEqual([
      {
        token: tokens[20],
        balanceLabel: '0,001 ZEC',
        stale: false,
      },
    ]);
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
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '1000000000000000000000000',
        balanceDecimal: '1',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: false,
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
      ...component.toToken,
      symbol: 'NEAR',
      decimals: 24,
    };
    component.amount = '2';

    component.submitQuote();

    expect(component.quoteError).toBe('Insufficient NEAR balance.');
  });

  it('requests a one-click preview when an amount is pasted into From', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    balancesService.balances = [nearBalance()];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next(nearWallet());
    component.fromToken = {
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };
    component.toToken = {
      assetId: 'nep141:usdc.near',
      symbol: 'USDC',
      name: 'USD Coin',
      color: '#2f8cff',
      decimals: 6,
      blockchain: 'near',
    };
    swapFlowFacade.watchQuotePreview.calls.reset();

    const input = document.createElement('input');
    const preventDefault = jasmine.createSpy('preventDefault');
    component.onAmountPaste({
      preventDefault,
      clipboardData: {
        getData: (type: string) =>
          type === 'text/plain' || type === 'text' ? '0,09' : '',
      },
      target: input,
    } as unknown as ClipboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(component.amount).toBe('0.09');
    expect(input.value).toBe('0,09');
    expect(swapFlowFacade.watchQuotePreview).toHaveBeenCalledWith(
      jasmine.objectContaining({
        source: jasmine.objectContaining({
          executionAssetId: 'nep141:wrap.near',
        }),
        destination: jasmine.objectContaining({
          executionAssetId: 'nep141:usdc.near',
        }),
        amount: '90000000000000000000000',
      })
    );
  });

  it('still requests a one-click preview when the pasted amount exceeds balance', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    balancesService.balances = [nearBalance()];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next(nearWallet());
    component.fromToken = {
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };
    swapFlowFacade.watchQuotePreview.calls.reset();

    const input = document.createElement('input');
    component.onAmountPaste({
      preventDefault: jasmine.createSpy('preventDefault'),
      clipboardData: {
        getData: () => '5',
      },
      target: input,
    } as unknown as ClipboardEvent);

    expect(component.amount).toBe('5');
    expect(swapFlowFacade.watchQuotePreview).toHaveBeenCalledWith(
      jasmine.objectContaining({
        amount: '5000000000000000000000000',
      })
    );
  });

  it('keeps Review disabled when the balance is stale', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    balancesService.balances = [
      {
        ...nearBalance(),
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    ];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next(nearWallet());
    component.fromToken = {
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };
    component.amount = '0.09';
    swapFlowFacade.emitQuote({
      amountOut: '0.0001',
      amountOutAtomic: '100',
      expiresAt: '2099-01-01T00:00:00.000Z',
      raw: { amountOut: '100' },
    });

    expect(component.balanceLabel(component.fromToken)).toContain('(stale)');
    expect(component.canReviewSwap()).toBeFalse();
    expect(component.isPrimaryActionDisabled()).toBeTrue();
    expect(component.primaryActionLabel()).toBe('Review');
  });

  it('keeps Review disabled when a formatted quote lacks atomic output', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    balancesService.balances = [nearBalance()];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next(nearWallet());
    component.fromToken = {
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };
    component.amount = '0.09';
    swapFlowFacade.emitQuote({
      amountOut: '0.0001',
      amountOutAtomic: '',
      expiresAt: '2099-01-01T00:00:00.000Z',
      raw: { amountOutFormatted: '0.0001' },
    });

    expect(component.canReviewSwap()).toBeFalse();
    expect(component.isPrimaryActionDisabled()).toBeTrue();
  });

  it('keeps Review disabled after the preview expiry passes', () => {
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

    walletsService.account.next(nearWallet());
    component.fromToken = {
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };
    component.amount = '0.09';
    swapFlowFacade.emitQuote({
      amountOut: '0.0001',
      amountOutAtomic: '100',
      expiresAt: '2020-01-01T00:00:00.000Z',
      raw: {
        quote: {
          amountOutFormatted: '0.0001',
        },
      },
    });

    expect(component.canReviewSwap()).toBeFalse();
    expect(component.isPrimaryActionDisabled()).toBeTrue();
    expect(component.primaryActionLabel()).toBe('Review');
  });

  it('refreshes wallet balances after confirmed settlement, not just submission', () => {
    const wallets = TestBed.inject(WalletsService);
    const loadBalances = spyOn(
      TestBed.inject(WalletBalancesService),
      'loadBalancesWithMeta'
    ).and.callThrough();
    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));
    wallets.account.next(nearWallet());
    loadBalances.calls.reset();
    wallets.swapSettled.next({ traceId: 'settled-swap', status: 'SUCCESS' });
    expect(loadBalances).toHaveBeenCalledTimes(1);
    expect(loadBalances).toHaveBeenCalledWith(
      jasmine.objectContaining({ walletAddress: 'alice.near' })
    );
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
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    const assetsService = TestBed.inject(
      ExchangeAssetsService
    ) as unknown as ExchangeAssetsServiceStub;

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    balancesService.balances = [
      {
        walletId: 'wallet-evm',
        walletAddress: '0x0000000000000000000000000000000000000001',
        chainType: 'ethereum',
        network: 'eip155:1',
        assetId:
          'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
        symbol: 'USDC',
        decimals: 6,
        balanceRaw: '10000000',
        balanceDecimal: '10',
        source: 'evm_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: false,
      },
    ];
    assetsService.tokens = [
      {
        assetId:
          'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
        symbol: 'USDC',
        name: 'USD Coin',
        color: '#2f8cff',
        decimals: 6,
        blockchain: 'eth',
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      },
    ];
    component.crossNetworkRecipientIntentSignEnabled = true;
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
        account: '0x0000000000000000000000000000000000000001',
        recipient: 'BYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z',
      })
    );
    expect(balancesService.calls).toContain(
      jasmine.objectContaining({
        walletAddress: '0x0000000000000000000000000000000000000001',
        network: 'eip155:1',
        assetIds: [
          'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
        ],
      })
    );
  });

  it('shows stale balances but does not use them to authorize a quote', () => {
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
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '2000000000000000000000000',
        balanceDecimal: '2',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: true,
      },
    ];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next({ account: 'alice.near', chainId: null });
    component.fromToken = { ...component.toToken, decimals: 24 };
    component.amount = '1';

    expect(component.balanceLabel(component.fromToken)).toBe(
      'Balance: 2 NEAR (stale)'
    );
    component.submitQuote();
    expect(component.quoteError).toBe('NEAR balance is loading.');
  });

  it('does not loop balance requests when the source is stale and another balance is fresh', () => {
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
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '2000000000000000000000000',
        balanceDecimal: '2',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: true,
      },
      {
        walletId: 'wallet-1',
        walletAddress: 'alice.near',
        chainType: 'near',
        network: 'near:mainnet',
        assetId: 'nep141:usdc.near',
        symbol: 'USDC',
        decimals: 6,
        balanceRaw: '1000000',
        balanceDecimal: '1',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: false,
      },
    ];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    component.amount = '1';
    walletsService.account.next({ account: 'alice.near', chainId: null });

    expect(balancesService.calls.length).toBe(1);
  });

  it('loads and authorizes balances for an implicit NEAR account', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const implicitAccount = 'a'.repeat(64);
    balancesService.balances = [
      {
        walletId: 'wallet-1',
        walletAddress: implicitAccount,
        chainType: 'near',
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '2000000000000000000000000',
        balanceDecimal: '2',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: false,
      },
    ];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    walletsService.account.next({ account: implicitAccount, chainId: null });
    component.fromToken = { ...component.toToken };
    component.amount = '1';
    component.submitQuote();

    expect(balancesService.calls).toEqual([
      {
        walletAddress: implicitAccount,
        network: 'near:mainnet',
      },
    ]);
    expect(component.quoteError).toBe('');
  });

  it('opens native NEAR review with origin-chain funding', () => {
    const balancesService = TestBed.inject(
      WalletBalancesService
    ) as unknown as WalletBalancesServiceStub;
    const walletsService = TestBed.inject(
      WalletsService
    ) as unknown as WalletsServiceStub;
    const swapFlowFacade = TestBed.inject(
      SwapFlowFacade
    ) as unknown as SwapFlowFacadeStub;
    const walletGateway = TestBed.inject(WalletGatewayBridgeService);
    const openReview = spyOn(walletGateway, 'openSwapReview');
    balancesService.balances = [
      {
        walletId: 'wallet-1',
        walletAddress: 'alice.near',
        chainType: 'near',
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '2000000000000000000000000',
        balanceDecimal: '2',
        source: 'near_rpc',
        fetchedAt: '2026-09-17T12:00:00.000Z',
        expiresAt: '2099-09-17T12:00:15.000Z',
        stale: false,
      },
    ];

    expectComparisonRequest({
      base: 'USDC',
      quote: 'NEAR',
      timeframe: '1H',
    }).flush(comparisonResponse('USDC', 'NEAR', '1H'));

    component.fromToken = {
      assetId: 'near:native',
      executionAssetId: 'nep141:wrap.near',
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      color: '#2fd17c',
      decimals: 24,
      blockchain: 'near',
    };
    component.toToken = {
      assetId: 'nep141:usdc.near',
      symbol: 'USDC',
      name: 'USD Coin',
      color: '#2f8cff',
      decimals: 6,
      blockchain: 'near',
    };
    component.amount = '1';
    walletsService.account.next({
      account: 'alice.near',
      chainId: null,
      identity: {
        connectorId: 'near',
        address: 'alice.near',
        chainType: 'near',
        walletType: 'external',
      },
    });
    swapFlowFacade.emitQuote({
      amountOut: '1000000',
      amountOutAtomic: '1000000',
      expiresAt: '2099-01-01T00:00:00.000Z',
      traceId: 'trace-review',
      raw: { amountOut: '1000000' },
    });

    component.submitQuote();

    expect(openReview).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        traceId: 'trace-review',
        contractVersion: '2.0.0',
        input: jasmine.objectContaining({
          source: jasmine.objectContaining({
            assetId: 'near:native',
            executionAssetId: 'nep141:wrap.near',
          }),
        }),
      })
    );
    expect(walletsService.requestOpen).toHaveBeenCalledOnceWith('swap-review');
  });

  it('fails closed when the foreign-recipient backend contract is disabled', () => {
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
    component.recipientAddress = 'BYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z';
    swapFlowFacade.watchQuotePreview.calls.reset();

    component.submitQuote();

    expect(component.quoteError).toContain(
      'Cross-network recipients are not available'
    );
    expect(swapFlowFacade.watchQuotePreview).not.toHaveBeenCalled();
    component.openTokenSelector('to');
    expect(
      component.tokenSelectorTokens().every(token => token.blockchain === 'eth')
    ).toBeTrue();
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

    component.crossNetworkRecipientIntentSignEnabled = true;
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
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '2000000000000000000000000',
        balanceDecimal: '2',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2099-08-12T12:00:15.000Z',
        stale: false,
      },
    ]);
    balancesService.balancesSubject.complete();

    expect(swapFlowFacade.watchQuotePreview).toHaveBeenCalledWith(
      jasmine.objectContaining({
        amount: '1000000000000000000000000',
        account: 'alice.near',
        recipient: '0x0000000000000000000000000000000000000002',
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
        network: 'near:mainnet',
        assetId: 'near:native',
        symbol: 'NEAR',
        decimals: 24,
        balanceRaw: '2000000000000000000000000',
        balanceDecimal: '2',
        source: 'near_rpc',
        fetchedAt: '2026-08-12T12:00:00.000Z',
        expiresAt: '2026-08-12T12:00:15.000Z',
        stale: false,
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

    expect(component.balanceLabel(component.fromToken)).toBe(
      'Balance: 2 NEAR (stale)'
    );

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

  function nearWallet(): WalletAccount {
    return {
      account: 'alice.near',
      chainId: null,
      identity: {
        connectorId: 'near',
        address: 'alice.near',
        chainType: 'near',
        walletType: 'external',
      },
    };
  }

  function nearBalance(): WalletBalance {
    return {
      walletId: 'wallet-1',
      walletAddress: 'alice.near',
      chainType: 'near',
      network: 'near:mainnet',
      assetId: 'near:native',
      symbol: 'NEAR',
      decimals: 24,
      balanceRaw: '2000000000000000000000000',
      balanceDecimal: '2',
      source: 'near_rpc',
      fetchedAt: '2026-09-20T12:00:00.000Z',
      expiresAt: '2099-09-20T12:00:15.000Z',
      stale: false,
    };
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
