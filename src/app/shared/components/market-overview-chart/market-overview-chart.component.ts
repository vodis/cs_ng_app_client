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
import type { LivelinePoint, LivelineSeries } from 'liveline';

export interface MarketOverviewChartSeries {
  id: string;
  label: string;
  color: string;
  points: LivelinePoint[];
}

@Component({
  selector: 'app-market-overview-chart',
  standalone: false,
  templateUrl: './market-overview-chart.component.html',
  styleUrls: ['./market-overview-chart.component.scss'],
})
export class MarketOverviewChartComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() public series: MarketOverviewChartSeries[] = [];
  @Input() public timeframe: '1H' | '1D' | '1W' = '1H';
  @Input() public ariaLabel = 'Market comparison chart';

  @ViewChild('chartHost', { static: true })
  private chartHost?: ElementRef<HTMLDivElement>;

  private reactRoot?: Root;
  private viewReady = false;

  public ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (
      this.viewReady &&
      (changes['series'] || changes['timeframe'] || changes['ariaLabel'])
    ) {
      this.renderChart();
    }
  }

  public ngOnDestroy(): void {
    this.reactRoot?.unmount();
    this.reactRoot = undefined;
  }

  private renderChart(): void {
    if (!this.viewReady || !this.chartHost) {
      return;
    }

    if (!this.reactRoot) {
      this.reactRoot = createRoot(this.chartHost.nativeElement);
    }

    const series = this.toLivelineSeries();
    const allPoints = series.flatMap(item => item.data);
    const firstTime = Math.min(...allPoints.map(point => point.time));
    const lastTime = Math.max(...allPoints.map(point => point.time));
    const windowSecs =
      Number.isFinite(firstTime) && Number.isFinite(lastTime)
        ? Math.max(lastTime - firstTime, this.minimumWindowSecs())
        : this.minimumWindowSecs();

    this.chartHost.nativeElement.setAttribute('aria-label', this.ariaLabel);
    this.chartHost.nativeElement.setAttribute('role', 'img');

    this.reactRoot.render(
      createElement(Liveline, {
        key: `${this.timeframe}-${series.map(item => item.id).join('-')}`,
        data: [],
        value: 0,
        series,
        theme: 'dark',
        grid: true,
        scrub: true,
        pulse: true,
        fill: false,
        badge: false,
        momentum: false,
        referenceLine: { value: 0, label: '0%' },
        seriesToggleCompact: true,
        window: windowSecs,
        lineWidth: 2,
        padding: {
          top: 10,
          right: 12,
          bottom: 18,
          left: 38,
        },
        formatValue: (value: number) => this.formatPercent(value),
        formatTime: (time: number) => this.formatTime(time),
      })
    );
  }

  private toLivelineSeries(): LivelineSeries[] {
    return this.series
      .map(item => ({
        id: item.id,
        label: item.label,
        color: item.color,
        data: item.points,
        value: item.points[item.points.length - 1]?.value ?? 0,
      }))
      .filter(item => item.data.length >= 2);
  }

  private minimumWindowSecs(): number {
    if (this.timeframe === '1W') {
      return 604_800;
    }

    if (this.timeframe === '1D') {
      return 86_400;
    }

    return 3_600;
  }

  private formatTime(time: number): string {
    if (this.timeframe === '1W') {
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

  private formatPercent(value: number): string {
    if (!Number.isFinite(value)) {
      return '--';
    }

    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }
}
