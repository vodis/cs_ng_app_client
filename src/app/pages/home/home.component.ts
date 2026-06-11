import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { ExchangeToken } from '@shared/models/exchange-token.model';
import { SwapFlowFacade } from '@domains/exchange/application/swap-flow.facade';
import type { SwapFlowState } from '@domains/exchange/models/swap.models';
import { environment } from '../../../environments/environment';

type TokenSelectorSide = 'from' | 'to';

type ComparisonTimeframe = '1H' | '1D' | '1W';

interface MarketComparisonToken {
  symbol: string;
  name?: string;
  icon?: string;
  currentPrice?: number;
  changePercent?: number;
  historyAvailable: boolean;
}

interface MarketComparisonPoint {
  time: number;
  value: number;
}

interface MarketComparisonSeries {
  symbol: string;
  points: MarketComparisonPoint[];
}

interface MarketComparisonResponse {
  base: string;
  quote: string;
  timeframe: ComparisonTimeframe;
  status: 'ready' | 'partial' | 'unavailable';
  baseToken: MarketComparisonToken;
  quoteToken: MarketComparisonToken;
  relativeStrength?: number;
  series: MarketComparisonSeries[];
}

interface ComparisonChartLine {
  symbol: string;
  path: string;
  color: string;
}

interface ComparisonYLabel {
  y: number;
  label: string;
}

interface ComparisonGridLine {
  y: number;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly comparisonWidth = 720;
  private readonly comparisonHeight = 220;
  private readonly comparisonPadding = {
    top: 16,
    right: 16,
    bottom: 28,
    left: 48,
  };
  public readonly exchangeTokens: ExchangeToken[] = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      assetId:
        'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
      color: '#2f8cff',
    },
    {
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      assetId: 'nep141:wrap.near',
      color: '#2fd17c',
    },
  ];

  public amount = '';
  public walletAddress = '';
  public fromToken = this.exchangeTokens[0];
  public toToken = this.exchangeTokens[1];
  public isTokenSelectorOpen = false;
  public tokenSelectorSide: TokenSelectorSide | null = null;
  public swapFlowState: SwapFlowState = 'idle';
  public quoteError = '';
  public quoteResult: Record<string, unknown> | undefined;
  public intentHash = '';
  public comparison?: MarketComparisonResponse;
  public comparisonLines: ComparisonChartLine[] = [];
  public comparisonYLabels: ComparisonYLabel[] = [];
  public comparisonBaselineY = 0;
  public comparisonGridLines: ComparisonGridLine[] = [];
  public comparisonLoading = true;
  public comparisonError = '';
  public selectedComparisonTimeframe: ComparisonTimeframe = '1D';
  public readonly comparisonTimeframes: ComparisonTimeframe[] = [
    '1H',
    '1D',
    '1W',
  ];
  public readonly comparisonViewBox = `0 0 ${this.comparisonWidth} ${this.comparisonHeight}`;
  public readonly comparisonPlotLeft = this.comparisonPadding.left;
  public readonly comparisonPlotRight =
    this.comparisonWidth - this.comparisonPadding.right;
  public comparisonAxisStart = '';
  public comparisonAxisMid = '';
  public comparisonAxisEnd = '';
  public showAdvancedMarketView = false;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly walletsService: WalletsService,
    private readonly swapFlowFacade: SwapFlowFacade
  ) {
    this.walletsService.account
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(account => {
        if (account?.account) {
          this.walletAddress = account.account;
        }
      });

    this.swapFlowFacade.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        this.swapFlowState = state;
      });

    this.swapFlowFacade.quotePreview$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(preview => {
        this.quoteResult = preview?.raw;
      });

    this.swapFlowFacade.error$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(error => {
        this.quoteError = error?.message ?? '';
      });

    this.swapFlowFacade.intentHash$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(intentHash => {
        this.intentHash = intentHash ?? '';
      });

    this.loadMarketComparison();
  }

  public submitQuote(): void {
    if (!this.walletAddress) {
      this.quoteError = 'Connect wallet first.';
      return;
    }

    const amount = this.toUsdcBaseUnits(this.amount);

    if (!amount || /^0+$/.test(amount)) {
      this.quoteError = `Enter a valid ${this.fromToken.symbol} amount.`;
      return;
    }

    if (this.quoteResult && this.canExecuteSwap()) {
      void this.executeSwap(amount);
      return;
    }

    void this.swapFlowFacade.requestQuotePreview(this.buildSwapInput(amount));
  }

  public isQuoteLoading(): boolean {
    return (
      this.swapFlowState === 'requestingQuote' ||
      this.swapFlowState === 'validating' ||
      this.swapFlowState === 'awaitingUserSignature' ||
      this.swapFlowState === 'submittingTransaction'
    );
  }

  private canExecuteSwap(): boolean {
    return (
      this.swapFlowState === 'idle' ||
      this.swapFlowState === 'completed' ||
      this.swapFlowState === 'failed'
    );
  }

  private async executeSwap(amount: string): Promise<void> {
    await this.swapFlowFacade.executeSwap(this.buildSwapInput(amount));
  }

  private buildSwapInput(amount: string) {
    return {
      originAsset: this.fromToken.assetId,
      destinationAsset: this.toToken.assetId,
      amount,
      userAddress: this.walletAddress.toLowerCase(),
      slippageTolerance: 50,
      deadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      authMethod: 'evm' as const,
    };
  }

  public changeComparisonTimeframe(timeframe: ComparisonTimeframe): void {
    if (this.selectedComparisonTimeframe === timeframe) {
      return;
    }

    this.selectedComparisonTimeframe = timeframe;
    this.loadMarketComparison();
  }

  public toggleAdvancedMarketView(): void {
    this.showAdvancedMarketView = !this.showAdvancedMarketView;
  }

  public swapTokens(): void {
    const previousFrom = this.fromToken;
    this.fromToken = this.toToken;
    this.toToken = previousFrom;
    this.swapFlowFacade.reset();
    this.quoteResult = undefined;
    this.quoteError = '';
    this.intentHash = '';
    this.loadMarketComparison();
  }

  public tokenIcon(symbol: string): string | undefined {
    const comparison = this.comparison;
    if (!comparison) {
      return this.exchangeTokens.find(token => token.symbol === symbol)?.icon;
    }

    if (comparison.baseToken.symbol === symbol) {
      return comparison.baseToken.icon;
    }

    if (comparison.quoteToken.symbol === symbol) {
      return comparison.quoteToken.icon;
    }

    return this.exchangeTokens.find(token => token.symbol === symbol)?.icon;
  }

  public fromFiatEstimate(): string {
    return this.fiatEstimate(this.fromToken.symbol, this.amount);
  }

  public toFiatEstimate(): string {
    return this.fiatEstimate(this.toToken.symbol, this.toAmountDisplay());
  }

  public toAmountDisplay(): string {
    const quote = this.quoteResult;
    const amount =
      quote?.['amountOut'] ??
      quote?.['destinationAmount'] ??
      quote?.['toAmount'];

    if (typeof amount === 'string' || typeof amount === 'number') {
      return String(amount);
    }

    return this.swapFlowFacade.quotePreview?.amountOut ?? '';
  }

  public primaryActionLabel(): string {
    if (!this.walletAddress) {
      return 'Connect wallet';
    }

    if (this.quoteResult) {
      return this.isQuoteLoading() ? 'Signing swap...' : 'Sign & swap';
    }

    return this.isQuoteLoading() ? 'Quoting...' : 'Get quote';
  }

  public onAmountKeydown(event: KeyboardEvent): void {
    const allowedControlKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];

    if (
      allowedControlKeys.includes(event.key) ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    if (/^\d$/.test(event.key)) {
      return;
    }

    if (event.key === '.') {
      const currentValue = (event.target as HTMLInputElement).value;
      if (!currentValue.includes('.')) {
        return;
      }
    }

    event.preventDefault();
  }

  public onAmountInput(event: Event): void {
    this.applySanitizedAmount(
      (event.target as HTMLInputElement).value,
      event.target as HTMLInputElement
    );
  }

  public onAmountPaste(event: ClipboardEvent): void {
    event.preventDefault();

    const input = event.target as HTMLInputElement;
    const pasted = event.clipboardData?.getData('text') ?? '';
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextValue =
      input.value.slice(0, start) + pasted + input.value.slice(end);

    this.applySanitizedAmount(nextValue, input);
  }

  public onAmountFocus(): void {
    if (this.isZeroAmountValue(this.amount)) {
      this.amount = '';
    }
  }

  public onAmountBlur(): void {
    if (!this.amount.trim() || this.isZeroAmountValue(this.amount)) {
      this.amount = '';
    }
  }

  public isAmountMuted(): boolean {
    const normalized = this.amount.trim();
    if (!normalized) {
      return false;
    }

    return this.isZeroAmountValue(normalized);
  }

  private applySanitizedAmount(value: string, input?: HTMLInputElement): void {
    const sanitized = this.sanitizeAmountInput(value);
    this.amount = sanitized;

    if (input && input.value !== sanitized) {
      input.value = sanitized;
    }
  }

  private sanitizeAmountInput(value: string): string {
    const digitsAndDot = value.replace(/[^\d.]/g, '');
    const dotIndex = digitsAndDot.indexOf('.');

    if (dotIndex === -1) {
      return digitsAndDot;
    }

    const whole = digitsAndDot.slice(0, dotIndex);
    const fraction = digitsAndDot
      .slice(dotIndex + 1)
      .replace(/\./g, '')
      .slice(0, 6);

    return `${whole}.${fraction}`;
  }

  private isZeroAmountValue(value: string): boolean {
    const normalized = value.trim();
    if (!normalized) {
      return true;
    }

    const parsed = Number.parseFloat(normalized);
    return !Number.isNaN(parsed) && parsed === 0;
  }

  public openTokenSelector(side: TokenSelectorSide): void {
    this.tokenSelectorSide = side;
    this.isTokenSelectorOpen = true;
  }

  public closeTokenSelector(): void {
    this.isTokenSelectorOpen = false;
    this.tokenSelectorSide = null;
  }

  public handleTokenSelected(token: ExchangeToken): void {
    if (this.tokenSelectorSide === 'from') {
      this.fromToken = token;
    } else if (this.tokenSelectorSide === 'to') {
      this.toToken = token;
    }

    this.swapFlowFacade.reset();
    this.quoteResult = undefined;
    this.quoteError = '';
    this.intentHash = '';
    this.closeTokenSelector();
    this.loadMarketComparison();
  }

  public tokenSelectorTitle(): string {
    return this.tokenSelectorSide === 'from'
      ? 'Select source token'
      : 'Select destination token';
  }

  public tokenSelectorSelectedSymbol(): string {
    if (this.tokenSelectorSide === 'from') {
      return this.fromToken.symbol;
    }

    if (this.tokenSelectorSide === 'to') {
      return this.toToken.symbol;
    }

    return '';
  }

  public tokenSelectorExcludedSymbol(): string {
    if (this.tokenSelectorSide === 'from') {
      return this.toToken.symbol;
    }

    if (this.tokenSelectorSide === 'to') {
      return this.fromToken.symbol;
    }

    return '';
  }

  public tokenColor(symbol: string): string {
    const token = this.exchangeTokens.find(item => item.symbol === symbol);
    return token?.color || '#fe6c00';
  }

  public formatPrice(value: number | undefined): string {
    if (value === undefined) {
      return 'Unavailable';
    }

    if (value >= 1000) {
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }

    if (value >= 1) {
      return `$${value.toFixed(2)}`;
    }

    return `$${value.toFixed(4)}`;
  }

  public formatPercent(value: number | undefined): string {
    if (value === undefined) {
      return '--';
    }

    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  public changeClass(value: number | undefined): string {
    if (value === undefined || value === 0) {
      return 'neutral';
    }

    return value > 0 ? 'positive' : 'negative';
  }

  public relativeStrengthText(): string {
    const comparison = this.comparison;
    const relative = comparison?.relativeStrength;

    if (!comparison || relative === undefined) {
      return 'Relative strength unavailable';
    }

    if (relative === 0) {
      return `${comparison.base} and ${comparison.quote} moved about the same over ${this.timeframeLabel(comparison.timeframe)}`;
    }

    const stronger = relative > 0 ? comparison.base : comparison.quote;
    const weaker = relative > 0 ? comparison.quote : comparison.base;
    return `${stronger} moved more than ${weaker} by ${Math.abs(relative).toFixed(2)}% over ${this.timeframeLabel(comparison.timeframe)}`;
  }

  public swapInsightText(): string {
    const comparison = this.comparison;
    if (!comparison) {
      return '';
    }

    const from = comparison.baseToken;
    const to = comparison.quoteToken;
    const window = this.timeframeLabel(comparison.timeframe);
    const fromChange = from.changePercent;
    const toChange = to.changePercent;

    if (fromChange === undefined || toChange === undefined) {
      return `Compare ${from.symbol} and ${to.symbol} price moves over ${window} before swapping.`;
    }

    const fromLabel = `${from.symbol} ${this.formatPercent(fromChange)}`;
    const toLabel = `${to.symbol} ${this.formatPercent(toChange)}`;

    if (Math.abs(fromChange) < 0.05 && Math.abs(toChange) < 0.05) {
      return `Both assets were flat over ${window}.`;
    }

    if (Math.abs(fromChange) < 0.05) {
      return `${from.symbol} held steady while ${to.symbol} moved ${this.formatPercent(toChange)} over ${window}.`;
    }

    if (Math.abs(toChange) < 0.05) {
      return `${to.symbol} held steady while ${from.symbol} moved ${this.formatPercent(fromChange)} over ${window}.`;
    }

    if (toChange > fromChange) {
      return `Swapping ${from.symbol} → ${to.symbol}: ${toLabel} vs ${fromLabel} over ${window}.`;
    }

    if (fromChange > toChange) {
      return `Swapping ${from.symbol} → ${to.symbol}: ${fromLabel} vs ${toLabel} over ${window}.`;
    }

    return `${fromLabel} and ${toLabel} over ${window}.`;
  }

  private loadMarketComparison(): void {
    const timeframe = this.selectedComparisonTimeframe;
    this.comparisonLoading = true;
    this.comparisonError = '';

    this.httpClient
      .get<MarketComparisonResponse>(
        `${environment.apiUrl}/api/v1/markets/comparison`,
        {
          params: {
            base: this.fromToken.symbol,
            quote: this.toToken.symbol,
            timeframe,
          },
        }
      )
      .subscribe({
        next: response => {
          if (this.selectedComparisonTimeframe !== timeframe) {
            return;
          }

          this.comparison = response;
          this.buildComparisonChart(response);
          this.comparisonError =
            response.status === 'unavailable'
              ? 'Comparison data unavailable'
              : '';
          this.comparisonLoading = false;
        },
        error: () => {
          if (this.selectedComparisonTimeframe !== timeframe) {
            return;
          }

          this.comparison = undefined;
          this.comparisonLines = [];
          this.comparisonYLabels = [];
          this.comparisonGridLines = [];
          this.comparisonBaselineY = 0;
          this.comparisonAxisStart = '';
          this.comparisonAxisMid = '';
          this.comparisonAxisEnd = '';
          this.comparisonError = 'Comparison data unavailable';
          this.comparisonLoading = false;
        },
      });
  }

  private buildComparisonChart(response: MarketComparisonResponse): void {
    const seriesWithPoints = response.series.filter(
      series => series.points.length > 0
    );
    const allPoints = seriesWithPoints.flatMap(series => series.points);

    if (allPoints.length === 0) {
      this.comparisonLines = [];
      this.comparisonYLabels = [];
      this.comparisonGridLines = [];
      this.comparisonBaselineY = 0;
      this.comparisonAxisStart = '';
      this.comparisonAxisMid = '';
      this.comparisonAxisEnd = '';
      return;
    }

    const timeMin = Math.min(...allPoints.map(point => point.time));
    const timeMax = Math.max(...allPoints.map(point => point.time));
    const timeRange = Math.max(timeMax - timeMin, 1);
    const minValue = Math.min(...allPoints.map(point => point.value));
    const maxValue = Math.max(...allPoints.map(point => point.value));
    const spread = Math.max(maxValue - minValue, 0.5);
    const yPad = Math.max(spread * 0.15, 0.25);
    const yMin = Math.min(minValue, 100) - yPad;
    const yMax = Math.max(maxValue, 100) + yPad;
    const yRange = Math.max(yMax - yMin, 0.0001);
    const innerWidth =
      this.comparisonWidth -
      this.comparisonPadding.left -
      this.comparisonPadding.right;
    const innerHeight =
      this.comparisonHeight -
      this.comparisonPadding.top -
      this.comparisonPadding.bottom;

    const toX = (time: number): number =>
      this.comparisonPadding.left + ((time - timeMin) / timeRange) * innerWidth;

    const toY = (value: number): number =>
      this.comparisonPadding.top + ((yMax - value) / yRange) * innerHeight;

    this.comparisonBaselineY = toY(100);
    this.comparisonGridLines = [0, 1, 2, 3].map(index => ({
      y: this.comparisonPadding.top + (index / 3) * innerHeight,
    }));

    const labelValues = [yMax, 100, yMin];
    this.comparisonYLabels = labelValues.map(value => ({
      y: toY(value),
      label: this.formatIndexLabel(value),
    }));

    this.comparisonLines = seriesWithPoints.map(series => {
      const path = series.points
        .map((point, index) => {
          const x = toX(point.time);
          const y = toY(point.value);
          return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ');

      return {
        symbol: series.symbol,
        path,
        color: this.tokenColor(series.symbol),
      };
    });

    this.comparisonAxisStart = this.formatComparisonTime(
      timeMin,
      response.timeframe
    );
    this.comparisonAxisEnd = this.formatComparisonTime(
      timeMax,
      response.timeframe
    );
    this.comparisonAxisMid = this.formatComparisonTime(
      timeMin + Math.floor(timeRange / 2),
      response.timeframe
    );
  }

  private formatIndexLabel(value: number): string {
    const change = value - 100;

    if (Math.abs(change) < 0.05) {
      return '0%';
    }

    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  }

  private timeframeLabel(timeframe: ComparisonTimeframe): string {
    if (timeframe === '1H') {
      return 'the last hour';
    }

    if (timeframe === '1D') {
      return 'the last 24 hours';
    }

    return 'the last 7 days';
  }

  private formatComparisonTime(
    time: number,
    timeframe: ComparisonTimeframe
  ): string {
    if (timeframe === '1W') {
      return new Date(time * 1000).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      });
    }

    return new Date(time * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private fiatEstimate(symbol: string, amountValue: string): string {
    const price = this.tokenPrice(symbol);
    const amount = Number.parseFloat(amountValue);

    if (price === undefined || Number.isNaN(amount)) {
      return '$0';
    }

    return this.formatPrice(price * amount);
  }

  private tokenPrice(symbol: string): number | undefined {
    const comparison = this.comparison;
    if (!comparison) {
      return undefined;
    }

    if (comparison.baseToken.symbol === symbol) {
      return comparison.baseToken.currentPrice;
    }

    if (comparison.quoteToken.symbol === symbol) {
      return comparison.quoteToken.currentPrice;
    }

    return undefined;
  }

  private toUsdcBaseUnits(value: string): string {
    const normalized = value.trim();

    if (!/^\d+(\.\d{0,6})?$/.test(normalized)) {
      return '';
    }

    const [whole, fraction = ''] = normalized.split('.');
    return `${whole}${fraction.padEnd(6, '0')}`.replace(/^0+(?=\d)/, '');
  }
}
