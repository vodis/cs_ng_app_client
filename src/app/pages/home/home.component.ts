import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { ExchangeToken } from '@shared/models/exchange-token.model';
import { environment } from '../../../environments/environment';

type TokenSelectorSide = 'from' | 'to';

interface OneClickQuoteRequest {
  dry: boolean;
  slippageTolerance: number;
  originAsset: string;
  destinationAsset: string;
  amount: string;
  deadline: string;
  userAddress: string;
  authMethod: 'evm';
  swapType: 'EXACT_INPUT';
  isConfidential: boolean;
  isAuthenticated: boolean;
}

interface QuoteApiResponse {
  data: unknown;
}

type ComparisonTimeframe = '1H' | '1D' | '1W' | '1M';

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
  fillPath: string;
  color: string;
}

interface ComparisonYLabel {
  y: number;
  label: string;
}

interface ComparisonGridLine {
  y: number;
}

interface RecentActivityItem {
  time: string;
  fromSymbol: string;
  toSymbol: string;
  fromDisplay: string;
  toDisplay: string;
  fromCoinClass?: string;
  toCoinClass?: string;
  amount: string;
  receive: string;
  status: string;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly comparisonWidth = 720;
  private readonly comparisonHeight = 220;
  private readonly comparisonPadding = {
    top: 16,
    right: 16,
    bottom: 28,
    left: 48,
  };
  private readonly slippageToleranceBps = 35;
  private readonly tokenIconUrls: Record<string, string> = {
    BTC: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1.png',
    ETH: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png',
    NEAR: 'https://s2.coinmarketcap.com/static/img/coins/128x128/6535.png',
    SOL: 'https://s2.coinmarketcap.com/static/img/coins/128x128/5426.png',
    USDC: 'https://s2.coinmarketcap.com/static/img/coins/128x128/3408.png',
    USDT: 'https://s2.coinmarketcap.com/static/img/coins/128x128/825.png',
  };

  public readonly recentActivity: RecentActivityItem[] = [
    {
      time: '14:25',
      fromSymbol: 'USDC',
      toSymbol: 'NEAR',
      fromDisplay: '$',
      toDisplay: 'N',
      toCoinClass: 'greenMini',
      amount: '100.00 USDC',
      receive: '45.61 NEAR',
      status: 'Completed',
    },
    {
      time: '13:58',
      fromSymbol: 'ETH',
      toSymbol: 'USDT',
      fromDisplay: '♦',
      toDisplay: 'T',
      fromCoinClass: 'purple',
      toCoinClass: 'teal',
      amount: '0.50 ETH',
      receive: '780.25 USDT',
      status: 'Completed',
    },
    {
      time: '12:42',
      fromSymbol: 'SOL',
      toSymbol: 'USDC',
      fromDisplay: '≡',
      toDisplay: '$',
      fromCoinClass: 'black',
      amount: '10.00 SOL',
      receive: '186.72 USDC',
      status: 'Completed',
    },
    {
      time: '11:21',
      fromSymbol: 'BTC',
      toSymbol: 'NEAR',
      fromDisplay: '₿',
      toDisplay: 'N',
      fromCoinClass: 'orangeMini',
      toCoinClass: 'greenMini',
      amount: '0.002 BTC',
      receive: '0.91 NEAR',
      status: 'Completed',
    },
    {
      time: '10:05',
      fromSymbol: 'USDC',
      toSymbol: 'ETH',
      fromDisplay: '$',
      toDisplay: '♦',
      toCoinClass: 'purple',
      amount: '250.00 USDC',
      receive: '0.12 ETH',
      status: 'Completed',
    },
  ];

  public readonly exchangeTokens: ExchangeToken[] = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      assetId:
        'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
      color: '#2f8cff',
      icon: 'https://s2.coinmarketcap.com/static/img/coins/128x128/3408.png',
    },
    {
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      assetId: 'nep141:wrap.near',
      color: '#2fd17c',
      icon: 'https://s2.coinmarketcap.com/static/img/coins/128x128/6535.png',
    },
  ];

  public amount = '100.00';
  public walletAddress = '';
  public fromToken = this.exchangeTokens[0];
  public toToken = this.exchangeTokens[1];
  public isTokenSelectorOpen = false;
  public tokenSelectorSide: TokenSelectorSide | null = null;
  public isQuoteLoading = false;
  public quoteError = '';
  public quoteResult: unknown;
  public comparison?: MarketComparisonResponse;
  public comparisonLines: ComparisonChartLine[] = [];
  public comparisonYLabels: ComparisonYLabel[] = [];
  public comparisonBaselineY = 0;
  public comparisonGridLines: ComparisonGridLine[] = [];
  public comparisonLoading = true;
  public comparisonError = '';
  public selectedComparisonTimeframe: ComparisonTimeframe = '1H';
  public readonly comparisonTimeframes: ComparisonTimeframe[] = [
    '1H',
    '1D',
    '1W',
    '1M',
  ];
  public readonly comparisonViewBox = `0 0 ${this.comparisonWidth} ${this.comparisonHeight}`;
  public readonly comparisonPlotLeft = this.comparisonPadding.left;
  public readonly comparisonPlotRight =
    this.comparisonWidth - this.comparisonPadding.right;
  public readonly comparisonAxisBottom = this.comparisonHeight - 6;
  public readonly comparisonAxisCenterX =
    (this.comparisonPlotLeft + this.comparisonPlotRight) / 2;
  public comparisonAxisStart = '';
  public comparisonAxisMid = '';
  public comparisonAxisEnd = '';
  public showAdvancedMarketView = false;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly walletsService: WalletsService
  ) {
    this.walletsService.account.subscribe(account => {
      if (account?.account) {
        this.walletAddress = account.account;
      }
    });
    this.loadMarketComparison();
  }

  public submitQuote(): void {
    this.quoteError = '';
    this.quoteResult = undefined;

    if (!this.walletAddress) {
      this.quoteError = 'Connect wallet first.';
      return;
    }

    const amount = this.toUsdcBaseUnits(this.amount);

    if (!amount || /^0+$/.test(amount)) {
      this.quoteError = `Enter a valid ${this.fromToken.symbol} amount.`;
      return;
    }

    this.isQuoteLoading = true;

    this.httpClient
      .post<QuoteApiResponse>(`${environment.apiUrl}/api/v1/quotes/one-click`, {
        dry: true,
        slippageTolerance: this.slippageToleranceBps,
        originAsset: this.fromToken.assetId,
        destinationAsset: this.toToken.assetId,
        amount,
        deadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        userAddress: this.walletAddress.toLowerCase(),
        authMethod: 'evm',
        swapType: 'EXACT_INPUT',
        isConfidential: false,
        isAuthenticated: true,
      } satisfies OneClickQuoteRequest)
      .subscribe({
        next: response => {
          this.quoteResult = response.data;
          this.isQuoteLoading = false;
        },
        error: error => {
          this.quoteError =
            error?.error?.message || 'Quote request failed. Try again.';
          this.isQuoteLoading = false;
        },
      });
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
    this.quoteResult = undefined;
    this.quoteError = '';
    this.loadMarketComparison();
  }

  public tokenIcon(symbol: string): string | undefined {
    const comparison = this.comparison;

    if (comparison?.baseToken.symbol === symbol && comparison.baseToken.icon) {
      return comparison.baseToken.icon;
    }

    if (
      comparison?.quoteToken.symbol === symbol &&
      comparison.quoteToken.icon
    ) {
      return comparison.quoteToken.icon;
    }

    const exchangeIcon = this.exchangeTokens.find(
      token => token.symbol === symbol
    )?.icon;
    if (exchangeIcon) {
      return exchangeIcon;
    }

    return this.tokenIconUrls[symbol];
  }

  public fromFiatEstimate(): string {
    return this.fiatEstimate(this.fromToken.symbol, this.amount);
  }

  public toFiatEstimate(): string {
    return this.fiatEstimate(this.toToken.symbol, this.toAmountUi());
  }

  public toAmountUi(): string {
    const quoted = this.toAmountDisplay();
    if (quoted) {
      return quoted;
    }

    return this.previewToAmount();
  }

  public marketPriceDisplay(): string {
    const price = this.comparison?.quoteToken?.currentPrice;
    if (price === undefined) {
      return '—';
    }

    return `$${price.toFixed(2)}`;
  }

  public toAmountDisplay(): string {
    const quote = this.quoteResult as Record<string, unknown> | undefined;
    const amount =
      quote?.['amountOut'] ??
      quote?.['destinationAmount'] ??
      quote?.['toAmount'];

    if (typeof amount === 'string' || typeof amount === 'number') {
      return String(amount);
    }

    return '';
  }

  public primaryActionLabel(): string {
    return this.walletAddress ? 'Get quote' : 'Connect wallet';
  }

  public tokenDisplay(symbol: string): string {
    if (symbol === 'USDC') {
      return '$';
    }

    return symbol[0] ?? '?';
  }

  public balanceLabel(symbol: string): string {
    if (symbol === 'USDC') {
      return 'Balance: 1,250.00 USDC';
    }

    if (symbol === 'NEAR') {
      return 'Balance: 42.5000 NEAR';
    }

    return `Balance: — ${symbol}`;
  }

  public swapRateLabel(): string {
    const amountIn = Number.parseFloat(this.amount);
    const amountOut = Number.parseFloat(this.toAmountUi());
    const rate =
      Number.isFinite(amountIn) && amountIn > 0 && Number.isFinite(amountOut)
        ? amountOut / amountIn
        : this.previewSwapRate();

    if (rate === undefined) {
      return `1 ${this.fromToken.symbol} ≈ — ${this.toToken.symbol}`;
    }

    return `1 ${this.fromToken.symbol} ≈ ${rate.toFixed(4)} ${this.toToken.symbol}`;
  }

  public swapPriceImpactLabel(): string {
    const quote = this.quoteResult as Record<string, unknown> | undefined;
    const impact =
      quote?.['priceImpact'] ??
      quote?.['priceImpactPercent'] ??
      quote?.['price_impact'];

    if (typeof impact === 'number' && Number.isFinite(impact)) {
      return `${impact.toFixed(2)}%`;
    }

    if (typeof impact === 'string' && impact.trim()) {
      return impact.includes('%') ? impact : `${impact}%`;
    }

    return '0.12%';
  }

  public slippageLabel(): string {
    return '0.35%';
  }

  public networkFeeLabel(): string {
    const quote = this.quoteResult as Record<string, unknown> | undefined;
    const fee =
      quote?.['networkFee'] ?? quote?.['estimatedFee'] ?? quote?.['fee'];

    if (typeof fee === 'number' && Number.isFinite(fee)) {
      return fee < 0.01 ? '< $0.01' : `$${fee.toFixed(2)}`;
    }

    if (typeof fee === 'string' && fee.trim()) {
      return fee;
    }

    return '< $0.01';
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

    this.quoteResult = undefined;
    this.quoteError = '';
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

    const bottomY = this.comparisonPadding.top + innerHeight;

    this.comparisonLines = seriesWithPoints.map(series => {
      const path = series.points
        .map((point, index) => {
          const x = toX(point.time);
          const y = toY(point.value);
          return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ');

      const firstX = toX(series.points[0].time);
      const lastX = toX(series.points[series.points.length - 1].time);
      const fillPath = `${path} L ${lastX.toFixed(2)} ${bottomY.toFixed(2)} L ${firstX.toFixed(2)} ${bottomY.toFixed(2)} Z`;

      return {
        symbol: series.symbol,
        path,
        fillPath,
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

    if (timeframe === '1W') {
      return 'the last 7 days';
    }

    return 'the last 30 days';
  }

  private formatComparisonTime(
    time: number,
    timeframe: ComparisonTimeframe
  ): string {
    if (timeframe === '1W' || timeframe === '1M') {
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

  private previewToAmount(): string {
    const amountIn = Number.parseFloat(this.amount);
    const rate = this.previewSwapRate();

    if (!Number.isFinite(amountIn) || amountIn <= 0 || rate === undefined) {
      return '0.00';
    }

    return (amountIn * rate).toFixed(2);
  }

  private previewSwapRate(): number | undefined {
    const amountIn = Number.parseFloat(this.amount);
    const amountOut = Number.parseFloat(this.toAmountDisplay());

    if (
      Number.isFinite(amountIn) &&
      amountIn > 0 &&
      Number.isFinite(amountOut) &&
      amountOut > 0
    ) {
      return amountOut / amountIn;
    }

    const basePrice = this.comparison?.baseToken?.currentPrice;
    const quotePrice = this.comparison?.quoteToken?.currentPrice;

    if (basePrice !== undefined && quotePrice !== undefined && basePrice > 0) {
      return quotePrice / basePrice;
    }

    if (this.fromToken.symbol === 'USDC' && this.toToken.symbol === 'NEAR') {
      return 0.4561;
    }

    return undefined;
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
