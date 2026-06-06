import { Component, NgZone, OnDestroy } from '@angular/core';
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

type ChartInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

const chartIntervalSeconds: Record<ChartInterval, number> = {
  '1m': 60,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  '1d': 24 * 60 * 60,
};

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
export class HomeComponent implements OnDestroy {
  private readonly chartWidth = 720;
  private readonly chartHeight = 260;
  private readonly chartPadding = { top: 18, right: 48, bottom: 42, left: 8 };
  private readonly volumeHeight = 48;
  private readonly chartLimit = 180;
  private readonly usdcAsset =
    'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near';
  private readonly nearAsset = 'nep141:wrap.near';
  private marketCandles: MarketCandle[] = [];
  private chartEvents?: EventSource;

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
  public selectedChartInterval: ChartInterval = '1m';
  public readonly chartIntervals: ChartInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
  public readonly Math = Math;
  public readonly chartViewBox = `0 0 ${this.chartWidth} ${this.chartHeight}`;
  public readonly candleWidth = 5;
  public readonly priceGridLines = [0, 1, 2, 3].map(index => ({
    y: this.chartPadding.top + index * 44,
  }));

  constructor(
    private readonly httpClient: HttpClient,
    private readonly walletsService: WalletsService,
    private readonly ngZone: NgZone
  ) {
    this.walletsService.account.subscribe(account => {
      if (account?.account) {
        this.walletAddress = account.account;
      }
    });
    this.loadMarketChart();
  }

  public ngOnDestroy(): void {
    this.closeChartStream();
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
    if (this.selectedChartInterval === '1d') {
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

  public changeChartInterval(interval: ChartInterval): void {
    if (this.selectedChartInterval === interval) {
      return;
    }

    this.selectedChartInterval = interval;
    this.chartError = '';
    this.closeChartStream();
    this.loadMarketChart();
  }

  private loadMarketChart(): void {
    const interval = this.selectedChartInterval;

    this.httpClient
      .get<MarketCandlesResponse>(
        `${environment.apiUrl}/api/v1/markets/NEAR/candles?interval=${interval}&limit=${this.chartLimit}`
      )
      .subscribe({
        next: response => {
          if (this.selectedChartInterval !== interval) {
            return;
          }

          const candles = response.candles.length
            ? response.candles
            : this.fallbackCandles();
          this.setMarketCandles(candles);
          this.chartError = '';
          this.openChartStream();
        },
        error: () => {
          if (this.selectedChartInterval !== interval) {
            return;
          }

          const fallback = this.fallbackCandles();
          this.chartError = 'Market chart unavailable.';
          this.setMarketCandles(fallback);
        },
      });
  }

  private openChartStream(): void {
    if (typeof EventSource === 'undefined') {
      return;
    }

    this.closeChartStream();
    this.chartEvents = new EventSource(
      `${environment.apiUrl}/api/v1/markets/NEAR/candles/stream?interval=${this.selectedChartInterval}`
    );

    this.chartEvents.onmessage = event => {
      this.ngZone.run(() => {
        const response = this.parseMarketCandleEvent(event.data);

        if (!response || response.interval !== this.selectedChartInterval) {
          return;
        }

        const candle = response.candles[0];
        if (!candle) {
          return;
        }

        this.upsertMarketCandle(candle);
        this.chartError = '';
      });
    };

    this.chartEvents.onerror = () => {
      this.ngZone.run(() => {
        this.chartError = 'Live chart stream reconnecting.';
      });
    };
  }

  private closeChartStream(): void {
    this.chartEvents?.close();
    this.chartEvents = undefined;
  }

  private parseMarketCandleEvent(data: string): MarketCandlesResponse | undefined {
    try {
      return JSON.parse(data) as MarketCandlesResponse;
    } catch {
      return undefined;
    }
  }

  private setMarketCandles(candles: MarketCandle[]): void {
    this.marketCandles = candles.slice(-this.chartLimit);
    this.chartCandles = this.toChartCandles(this.marketCandles);
    this.setChartSummary(this.marketCandles);
  }

  private upsertMarketCandle(candle: MarketCandle): void {
    const index = this.marketCandles.findIndex(item => item.time === candle.time);

    if (index >= 0) {
      this.marketCandles[index] = candle;
    } else {
      this.marketCandles = [...this.marketCandles, candle].slice(-this.chartLimit);
    }

    this.chartCandles = this.toChartCandles(this.marketCandles);
    this.setChartSummary(this.marketCandles);
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
    const intervalSeconds = chartIntervalSeconds[this.selectedChartInterval];
    const now = Math.floor(Date.now() / 1000 / intervalSeconds) * intervalSeconds;
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
        time: now - (72 - index) * intervalSeconds,
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
