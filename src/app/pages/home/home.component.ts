import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { environment } from '../../../environments/environment';

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
    top: 18,
    right: 18,
    bottom: 32,
    left: 18,
  };
  private readonly usdcAsset =
    'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near';
  private readonly nearAsset = 'nep141:wrap.near';

  public amount = '1';
  public walletAddress = '';
  public readonly fromAssetLabel = 'USDC';
  public readonly toAssetLabel = 'NEAR';
  public readonly fromAssetId = this.usdcAsset;
  public readonly toAssetId = this.nearAsset;
  public readonly tokenColors: Record<string, string> = {
    USDC: '#2f8cff',
    NEAR: '#2fd17c',
  };
  public isQuoteLoading = false;
  public quoteError = '';
  public quoteResult: unknown;
  public comparison?: MarketComparisonResponse;
  public comparisonLines: ComparisonChartLine[] = [];
  public comparisonLoading = true;
  public comparisonError = '';
  public selectedComparisonTimeframe: ComparisonTimeframe = '1D';
  public readonly comparisonTimeframes: ComparisonTimeframe[] = [
    '1H',
    '1D',
    '1W',
  ];
  public readonly comparisonViewBox = `0 0 ${this.comparisonWidth} ${this.comparisonHeight}`;
  public readonly comparisonGridLines = [0, 1, 2, 3].map(index => ({
    y: this.comparisonPadding.top + index * 43,
  }));
  public comparisonAxisStart = '';
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

    if (!amount || amount === '0') {
      this.quoteError = 'Enter a valid USDC amount.';
      return;
    }

    this.isQuoteLoading = true;

    this.httpClient
      .post<QuoteApiResponse>(`${environment.apiUrl}/api/v1/quotes/one-click`, {
        dry: true,
        slippageTolerance: 50,
        originAsset: this.usdcAsset,
        destinationAsset: this.nearAsset,
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

  public tokenColor(symbol: string): string {
    return this.tokenColors[symbol] || '#fe6c00';
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
      return `${comparison.base} and ${comparison.quote} are even over ${comparison.timeframe}`;
    }

    const stronger = relative > 0 ? comparison.base : comparison.quote;
    const weaker = relative > 0 ? comparison.quote : comparison.base;
    return `${stronger} outperforming ${weaker} by ${Math.abs(relative).toFixed(2)}%`;
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
            base: this.fromAssetLabel,
            quote: this.toAssetLabel,
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
          this.comparisonLines = this.toComparisonLines(response);
          this.setComparisonAxis(response);
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
          this.comparisonAxisStart = '';
          this.comparisonAxisEnd = '';
          this.comparisonError = 'Comparison data unavailable';
          this.comparisonLoading = false;
        },
      });
  }

  private toComparisonLines(
    response: MarketComparisonResponse
  ): ComparisonChartLine[] {
    const allPoints = response.series.flatMap(series => series.points);
    if (allPoints.length === 0) {
      return [];
    }

    const minValue = Math.min(...allPoints.map(point => point.value));
    const maxValue = Math.max(...allPoints.map(point => point.value));
    const valueRange = Math.max(maxValue - minValue, 0.0001);
    const innerWidth =
      this.comparisonWidth -
      this.comparisonPadding.left -
      this.comparisonPadding.right;
    const innerHeight =
      this.comparisonHeight -
      this.comparisonPadding.top -
      this.comparisonPadding.bottom;

    return response.series
      .filter(series => series.points.length > 0)
      .map(series => {
        const step = innerWidth / Math.max(series.points.length - 1, 1);
        const path = series.points
          .map((point, index) => {
            const x = this.comparisonPadding.left + index * step;
            const y =
              this.comparisonPadding.top +
              ((maxValue - point.value) / valueRange) * innerHeight;
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
          })
          .join(' ');

        return {
          symbol: series.symbol,
          path,
          color: this.tokenColor(series.symbol),
        };
      });
  }

  private setComparisonAxis(response: MarketComparisonResponse): void {
    const points = response.series.flatMap(series => series.points);

    if (points.length === 0) {
      this.comparisonAxisStart = '';
      this.comparisonAxisEnd = '';
      return;
    }

    const first = Math.min(...points.map(point => point.time));
    const last = Math.max(...points.map(point => point.time));
    this.comparisonAxisStart = this.formatComparisonTime(
      first,
      response.timeframe
    );
    this.comparisonAxisEnd = this.formatComparisonTime(
      last,
      response.timeframe
    );
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

  private toUsdcBaseUnits(value: string): string {
    const normalized = value.trim();

    if (!/^\d+(\.\d{0,6})?$/.test(normalized)) {
      return '';
    }

    const [whole, fraction = ''] = normalized.split('.');
    return `${whole}${fraction.padEnd(6, '0')}`.replace(/^0+(?=\d)/, '');
  }
}
