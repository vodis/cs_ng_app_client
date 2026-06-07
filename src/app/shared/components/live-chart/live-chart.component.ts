import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Liveline } from 'liveline';
import { Subscription } from 'rxjs';
import {
  CHART_WINDOW_OPTIONS,
  ChartMode,
  ChartWindowConfig,
} from '@shared/models/chart.models';
import { ChartSettingsService } from '@shared/services/chart-settings.service';
import { MarketChartService } from '@shared/services/market-chart.service';
import {
  changeClass,
  formatChartPrice,
  formatChartTime,
  formatPercent,
  toLiveChartRenderModel,
} from './live-chart.utils';

@Component({
  selector: 'app-live-chart',
  standalone: false,
  templateUrl: './live-chart.component.html',
  styleUrls: ['./live-chart.component.scss'],
})
export class LiveChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() public coin = 'NEAR';
  @Input() public active = false;

  @ViewChild('chartHost', { static: true })
  private chartHost?: ElementRef<HTMLDivElement>;

  public headerPrice = 'Loading';
  public headerChange = '--';
  public headerChangeClass = 'neutral';
  public errorMessage = '';
  public readonly windowOptions: ChartWindowConfig[] = CHART_WINDOW_OPTIONS;

  private reactRoot?: Root;
  private streamSubscription?: Subscription;
  private viewReady = false;

  constructor(
    private readonly chartService: MarketChartService,
    private readonly chartSettings: ChartSettingsService
  ) {}

  public ngAfterViewInit(): void {
    this.viewReady = true;
    this.syncConnection();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) {
      return;
    }

    if (changes['active'] || changes['coin']) {
      this.syncConnection();
    }
  }

  public selectedWindowSecs(): number {
    return this.chartSettings.windowSecs;
  }

  public selectWindow(windowSecs: number): void {
    if (this.chartSettings.windowSecs === windowSecs) {
      return;
    }

    this.chartSettings.setWindowSecs(windowSecs);

    if (this.active) {
      this.chartService.connect(this.coin, windowSecs);
    }
  }

  public ngOnDestroy(): void {
    this.streamSubscription?.unsubscribe();
    this.chartService.disconnect();
    this.reactRoot?.unmount();
    this.reactRoot = undefined;
  }

  private syncConnection(): void {
    this.streamSubscription?.unsubscribe();

    if (!this.active) {
      this.chartService.disconnect();
      this.renderChart();
      return;
    }

    this.chartService.connect(this.coin, this.chartSettings.windowSecs);
    this.streamSubscription = this.chartService.state$.subscribe(() => {
      this.updateHeader();
      this.renderChart();
    });
  }

  private updateHeader(): void {
    const state = this.chartService.snapshot();
    this.errorMessage = state.error ?? '';

    if (state.loading) {
      this.headerPrice = 'Loading';
      this.headerChange = '--';
      this.headerChangeClass = 'neutral';
      return;
    }

    this.headerPrice = state.currentPrice
      ? formatChartPrice(state.currentPrice)
      : 'Unavailable';
    this.headerChange = formatPercent(state.change24hPercent);
    this.headerChangeClass = changeClass(state.change24hPercent);
  }

  private renderChart(): void {
    if (!this.viewReady || !this.chartHost) {
      return;
    }

    if (!this.reactRoot) {
      this.reactRoot = createRoot(this.chartHost.nativeElement);
    }

    if (!this.active) {
      this.reactRoot.render(null);
      return;
    }

    const settings = this.chartSettings.snapshot();
    const model = toLiveChartRenderModel(
      this.chartService.snapshot(),
      settings.mode,
      settings.windowSecs
    );

    this.reactRoot.render(
      createElement(Liveline, {
        key: `${this.coin}-${settings.mode}-${settings.windowSecs}`,
        theme: 'dark',
        mode: model.mode,
        lineMode: model.mode === 'line',
        data: model.data,
        value: model.value,
        candles: model.candles,
        liveCandle: model.liveCandle,
        candleWidth: model.candleWidth,
        lineData: model.lineData,
        lineValue: model.lineValue,
        color: model.color,
        window: model.windowSecs,
        loading: model.loading,
        grid: true,
        badge: true,
        badgeVariant: 'minimal',
        momentum: true,
        fill: model.mode === 'line',
        scrub: true,
        pulse: true,
        lerpSpeed: 0.08,
        formatValue: formatChartPrice,
        formatTime: (time: number) => formatChartTime(time, model.windowSecs),
        onModeChange: (mode: ChartMode) => {
          this.chartSettings.setMode(mode);
          this.renderChart();
        },
      })
    );
  }
}
