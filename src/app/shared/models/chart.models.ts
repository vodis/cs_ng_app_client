export type ChartMode = 'line' | 'candle';

export type ChartWindowLabel = '1H' | '4H' | '1D' | '1W';

export type HyperliquidInterval = '1m' | '5m' | '15m' | '1h';

export interface ChartSettings {
  mode: ChartMode;
  windowSecs: number;
}

export interface ChartWindowConfig {
  label: ChartWindowLabel;
  windowSecs: number;
  interval: HyperliquidInterval;
  lookbackMs: number;
  candleWidth: number;
}

export interface HLCandle {
  time: number;
  value: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartStreamState {
  loading: boolean;
  error?: string;
  candles: HLCandle[];
  currentPrice: number;
  change24hPercent?: number;
}

export const CHART_WINDOW_OPTIONS: ChartWindowConfig[] = [
  {
    label: '1H',
    windowSecs: 3600,
    interval: '1m',
    lookbackMs: 3_600_000,
    candleWidth: 60,
  },
  {
    label: '4H',
    windowSecs: 14_400,
    interval: '5m',
    lookbackMs: 14_400_000,
    candleWidth: 300,
  },
  {
    label: '1D',
    windowSecs: 86_400,
    interval: '15m',
    lookbackMs: 86_400_000,
    candleWidth: 900,
  },
  {
    label: '1W',
    windowSecs: 604_800,
    interval: '1h',
    lookbackMs: 604_800_000,
    candleWidth: 3600,
  },
];

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  mode: 'candle',
  windowSecs: 3600,
};

export function chartWindowConfig(windowSecs: number): ChartWindowConfig {
  return (
    CHART_WINDOW_OPTIONS.find(option => option.windowSecs === windowSecs) ??
    CHART_WINDOW_OPTIONS[0]
  );
}
