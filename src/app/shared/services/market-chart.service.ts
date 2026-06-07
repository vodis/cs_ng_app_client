import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChartStreamState, HLCandle } from '@shared/models/chart.models';

const POLL_INTERVAL_MS = 15_000;
const CHART_WS_PATH = '/api/v1/markets/chart/ws';

const EMPTY_STATE: ChartStreamState = {
  loading: true,
  candles: [],
  currentPrice: 0,
};

interface MarketChartCandleDto {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MarketChartResponseDto {
  symbol: string;
  interval: string;
  windowSecs: number;
  candles: MarketChartCandleDto[];
  prevDayPx?: number;
  currentPrice?: number;
  change24hPercent?: number;
}

interface MarketMidMessage {
  event: 'mid' | 'error';
  data: {
    symbol?: string;
    price?: number;
    change24hPercent?: number;
    message?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class MarketChartService implements OnDestroy {
  private readonly stateSubject = new BehaviorSubject<ChartStreamState>(
    EMPTY_STATE
  );

  private pollTimer?: ReturnType<typeof setInterval>;
  private socket?: WebSocket;
  private activeCoin?: string;
  private activeWindowSecs = 3600;
  private pendingBootstrapKey?: string;

  public readonly state$ = this.stateSubject.asObservable();

  constructor(
    private readonly httpClient: HttpClient,
    private readonly ngZone: NgZone
  ) {}

  public snapshot(): ChartStreamState {
    return this.stateSubject.value;
  }

  public ngOnDestroy(): void {
    this.disconnect();
  }

  public connect(coin: string, windowSecs: number): void {
    const normalizedCoin = coin.toUpperCase();
    const sessionKey = `${normalizedCoin}:${windowSecs}`;
    const reconnect =
      this.activeCoin !== normalizedCoin ||
      this.activeWindowSecs !== windowSecs;

    if (this.pendingBootstrapKey === sessionKey) {
      return;
    }

    if (
      !reconnect &&
      this.pollTimer &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    this.disconnect();
    this.activeCoin = normalizedCoin;
    this.activeWindowSecs = windowSecs;
    this.pendingBootstrapKey = sessionKey;
    this.stateSubject.next({
      ...EMPTY_STATE,
      loading: true,
    });

    void this.bootstrap(normalizedCoin, windowSecs).finally(() => {
      if (this.pendingBootstrapKey === sessionKey) {
        this.pendingBootstrapKey = undefined;
      }
    });
  }

  public disconnect(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    this.closeSocket();
    this.activeCoin = undefined;
    this.pendingBootstrapKey = undefined;
    this.stateSubject.next(EMPTY_STATE);
  }

  private async bootstrap(coin: string, windowSecs: number): Promise<void> {
    try {
      await this.fetchChart(coin, windowSecs);
      this.connectSocket(coin);
      this.startPolling(coin, windowSecs);
    } catch {
      this.ngZone.run(() => {
        this.stateSubject.next({
          loading: false,
          candles: [],
          currentPrice: 0,
          error: 'Market chart unavailable.',
        });
      });
    }
  }

  private startPolling(coin: string, windowSecs: number): void {
    this.pollTimer = setInterval(() => {
      void this.fetchChart(coin, windowSecs);
    }, POLL_INTERVAL_MS);
  }

  private async fetchChart(coin: string, windowSecs: number): Promise<void> {
    const response = await firstValueFrom(
      this.httpClient.get<MarketChartResponseDto>(
        `${environment.apiUrl}/api/v1/markets/${coin}/chart`,
        {
          params: { windowSecs: String(windowSecs) },
        }
      )
    );

    const candles = response.candles.map(candle =>
      this.normalizeCandle(candle)
    );
    const current = this.stateSubject.value;
    const currentPrice =
      current.currentPrice > 0
        ? current.currentPrice
        : (response.currentPrice ?? candles[candles.length - 1]?.close ?? 0);

    this.ngZone.run(() => {
      this.stateSubject.next({
        loading: false,
        candles,
        currentPrice,
        change24hPercent: response.change24hPercent,
        error: candles.length ? undefined : 'No candle data available.',
      });
    });
  }

  private connectSocket(coin: string): void {
    this.closeSocket();

    const socket = new WebSocket(this.buildChartWebSocketUrl());
    this.socket = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          event: 'subscribe',
          data: { symbol: coin },
        })
      );
    };

    socket.onmessage = event => {
      this.ngZone.run(() => this.handleSocketMessage(event.data));
    };

    socket.onclose = () => {
      if (this.socket !== socket) {
        return;
      }

      this.socket = undefined;

      if (this.activeCoin !== coin) {
        return;
      }

      setTimeout(() => {
        if (this.activeCoin === coin && !this.socket) {
          this.connectSocket(coin);
        }
      }, 2000);
    };
  }

  private handleSocketMessage(raw: unknown): void {
    if (typeof raw !== 'string') {
      return;
    }

    let message: MarketMidMessage;
    try {
      message = JSON.parse(raw) as MarketMidMessage;
    } catch {
      return;
    }

    if (message.event === 'error') {
      return;
    }

    if (message.event !== 'mid') {
      return;
    }

    const coin = this.activeCoin;
    const price = message.data.price;
    if (
      !coin ||
      message.data.symbol !== coin ||
      !Number.isFinite(price) ||
      !price
    ) {
      return;
    }

    const current = this.stateSubject.value;
    this.stateSubject.next({
      ...current,
      currentPrice: price,
      change24hPercent:
        message.data.change24hPercent ?? current.change24hPercent,
    });
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = undefined;

    if (!socket) {
      return;
    }

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          event: 'unsubscribe',
          data: {},
        })
      );
    }

    socket.close();
  }

  private buildChartWebSocketUrl(): string {
    const url = new URL(environment.apiUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = CHART_WS_PATH;
    url.search = '';
    return url.toString();
  }

  private normalizeCandle(candle: MarketChartCandleDto): HLCandle {
    const close = candle.close;

    return {
      time: candle.time * 1000,
      value: close,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close,
    };
  }
}
