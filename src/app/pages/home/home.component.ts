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

interface MarketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketCandlesResponse {
  symbol: string;
  interval: string;
  candles: MarketCandle[];
}

interface ChartCandle extends MarketCandle {
  x: number;
  openY: number;
  highY: number;
  lowY: number;
  closeY: number;
  volumeY: number;
  volumeHeight: number;
  color: string;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly chartWidth = 720;
  private readonly chartHeight = 260;
  private readonly chartPadding = { top: 18, right: 48, bottom: 42, left: 8 };
  private readonly volumeHeight = 48;
  private readonly usdcAsset =
    'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near';
  private readonly nearAsset = 'nep141:wrap.near';

  public amount = '1';
  public walletAddress = '';
  public readonly fromAssetLabel = 'USDC';
  public readonly toAssetLabel = 'NEAR';
  public readonly fromAssetId = this.usdcAsset;
  public readonly toAssetId = this.nearAsset;
  public isQuoteLoading = false;
  public quoteError = '';
  public quoteResult: unknown;
  public chartCandles: ChartCandle[] = [];
  public chartError = '';
  public chartPrice = '';
  public chartChange = '';
  public chartChangeClass = 'neutral';
  public readonly Math = Math;
  public readonly chartViewBox = `0 0 ${this.chartWidth} ${this.chartHeight}`;
  public readonly candleWidth = 5;
  public readonly priceGridLines = [0, 1, 2, 3].map(index => ({
    y: this.chartPadding.top + index * 44,
  }));

  constructor(
    private readonly httpClient: HttpClient,
    private readonly walletsService: WalletsService
  ) {
    this.walletsService.account.subscribe(account => {
      if (account?.account) {
        this.walletAddress = account.account;
      }
    });
    this.loadMarketChart();
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

  public formatChartTime(time: number): string {
    return new Date(time * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private loadMarketChart(): void {
    this.httpClient
      .get<MarketCandlesResponse>(
        `${environment.apiUrl}/api/v1/markets/NEAR/candles?interval=1h&limit=120`
      )
      .subscribe({
        next: response => {
          const candles = response.candles.length
            ? response.candles
            : this.fallbackCandles();
          this.chartCandles = this.toChartCandles(candles);
          this.setChartSummary(candles);
          this.chartError = '';
        },
        error: () => {
          const fallback = this.fallbackCandles();
          this.chartError = 'Market chart unavailable.';
          this.chartCandles = this.toChartCandles(fallback);
          this.setChartSummary(fallback);
        },
      });
  }

  private setChartSummary(candles: MarketCandle[]): void {
    const first = candles[0];
    const last = candles[candles.length - 1];

    if (!first || !last) {
      this.chartPrice = '';
      this.chartChange = '';
      this.chartChangeClass = 'neutral';
      return;
    }

    const change = last.close - first.open;
    const changePercent = first.open > 0 ? (change / first.open) * 100 : 0;
    this.chartPrice = `$${last.close.toFixed(3)}`;
    this.chartChange = `${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
    this.chartChangeClass =
      change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
  }

  private toChartCandles(candles: MarketCandle[]): ChartCandle[] {
    const visible = candles.slice(-90);
    if (visible.length === 0) {
      return [];
    }

    const values = visible.flatMap(candle => [
      candle.open,
      candle.high,
      candle.low,
      candle.close,
    ]);
    const minPrice = Math.min(...values);
    const maxPrice = Math.max(...values);
    const maxVolume = Math.max(...visible.map(candle => candle.volume), 1);
    const priceHeight =
      this.chartHeight -
      this.chartPadding.top -
      this.chartPadding.bottom -
      this.volumeHeight;
    const priceRange = Math.max(maxPrice - minPrice, 0.0001);
    const step =
      (this.chartWidth - this.chartPadding.left - this.chartPadding.right) /
      Math.max(visible.length - 1, 1);

    return visible.map((candle, index) => {
      const toY = (price: number): number =>
        this.chartPadding.top + ((maxPrice - price) / priceRange) * priceHeight;
      const volumeHeight = (candle.volume / maxVolume) * (this.volumeHeight - 8);
      const volumeBase = this.chartHeight - this.chartPadding.bottom + 24;

      return {
        ...candle,
        x: this.chartPadding.left + index * step,
        openY: toY(candle.open),
        highY: toY(candle.high),
        lowY: toY(candle.low),
        closeY: toY(candle.close),
        volumeY: volumeBase - volumeHeight,
        volumeHeight,
        color: candle.close >= candle.open ? '#2fd17c' : '#ff5d5d',
      };
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

  private fallbackCandles(): MarketCandle[] {
    const now = Math.floor(Date.now() / 1000 / 3600) * 3600;
    const candles: MarketCandle[] = [];
    let price = 1.95;

    for (let index = 0; index < 72; index += 1) {
      const drift = Math.sin(index / 5) * 0.018 + Math.cos(index / 11) * 0.012;
      const open = price;
      const close = Math.max(0.1, open + drift);
      const high = Math.max(open, close) + 0.025 + Math.sin(index) * 0.004;
      const low = Math.min(open, close) - 0.025 + Math.cos(index) * 0.004;
      price = close;
      candles.push({
        time: now - (72 - index) * 3600,
        open,
        high,
        low,
        close,
        volume: 80000 + Math.abs(Math.sin(index / 3)) * 140000,
      });
    }

    return candles;
  }
}
