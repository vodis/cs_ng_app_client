import type { CandlePoint, LivelinePoint } from 'liveline';
import {
  ChartMode,
  ChartStreamState,
  HLCandle,
  chartWindowConfig,
} from '@shared/models/chart.models';

const LINE_UP_COLOR = '#00C076';
const LINE_DOWN_COLOR = '#f43f5e';

export function formatChartPrice(value: number): string {
  if (value < 0.01) {
    return `$${value.toFixed(6)}`;
  }

  if (value < 1) {
    return `$${value.toFixed(4)}`;
  }

  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatChartTime(time: number, windowSecs: number): string {
  const date = new Date(time * 1000);

  if (windowSecs >= 604_800) {
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function lineColorForWindow(
  lineData: LivelinePoint[],
  currentPrice: number
): string {
  const first = lineData[0]?.value ?? currentPrice;
  return currentPrice >= first ? LINE_UP_COLOR : LINE_DOWN_COLOR;
}

export function buildLineData(
  candles: HLCandle[],
  currentPrice: number
): LivelinePoint[] {
  const lineData = candles.map(candle => ({
    time: Math.floor(candle.time / 1000),
    value: candle.close,
  }));

  lineData.push({
    time: Math.floor(Date.now() / 1000),
    value: currentPrice,
  });

  return lineData;
}

export function buildCandlePoints(candles: HLCandle[]): CandlePoint[] {
  return candles.slice(0, -1).map(candle => ({
    time: Math.floor(candle.time / 1000),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

export function buildLiveCandle(
  candles: HLCandle[],
  currentPrice: number,
  candleWidth: number
): CandlePoint | undefined {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return undefined;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const bucketStart = Math.floor(nowSec / candleWidth) * candleWidth;
  const last = candles[candles.length - 1];
  const lastBucket = last ? Math.floor(last.time / 1000) : undefined;

  if (last && lastBucket === bucketStart) {
    return {
      time: bucketStart,
      open: last.open,
      high: Math.max(last.high, currentPrice),
      low: Math.min(last.low, currentPrice),
      close: currentPrice,
    };
  }

  return {
    time: bucketStart,
    open: currentPrice,
    high: currentPrice,
    low: currentPrice,
    close: currentPrice,
  };
}

export interface LiveChartRenderModel {
  mode: ChartMode;
  windowSecs: number;
  loading: boolean;
  color: string;
  data: LivelinePoint[];
  value: number;
  candles: CandlePoint[];
  liveCandle?: CandlePoint;
  candleWidth: number;
  lineData: LivelinePoint[];
  lineValue: number;
}

export function toLiveChartRenderModel(
  state: ChartStreamState,
  mode: ChartMode,
  windowSecs: number
): LiveChartRenderModel {
  const config = chartWindowConfig(windowSecs);
  const lineData = buildLineData(state.candles, state.currentPrice);
  const value = state.currentPrice || lineData[lineData.length - 1]?.value || 0;

  return {
    mode,
    windowSecs,
    loading: state.loading,
    color: lineColorForWindow(lineData, value),
    data: lineData,
    value,
    candles: buildCandlePoints(state.candles),
    liveCandle: buildLiveCandle(state.candles, value, config.candleWidth),
    candleWidth: config.candleWidth,
    lineData,
    lineValue: value,
  };
}

export function formatPercent(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function changeClass(value: number | undefined): string {
  if (value === undefined || value === 0) {
    return 'neutral';
  }

  return value > 0 ? 'positive' : 'negative';
}
