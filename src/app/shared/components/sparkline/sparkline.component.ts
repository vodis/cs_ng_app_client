import { Component, Input } from '@angular/core';
import {
  buildSmoothPath,
  hashSparklineValues,
  toSparklinePoints,
} from './sparkline.util';

@Component({
  selector: 'app-sparkline',
  standalone: false,
  templateUrl: './sparkline.component.html',
  styleUrls: ['./sparkline.component.scss'],
})
export class SparklineComponent {
  @Input() public values: number[] = [];
  @Input() public positive = true;
  @Input() public width = 96;
  @Input() public height = 32;
  @Input() public label = '7-day price trend';

  public get canRender(): boolean {
    return this.values.length >= 2;
  }

  public get stroke(): string {
    return this.positive ? '#16c784' : '#ea3943';
  }

  public get gradientId(): string {
    const direction = this.positive ? 'up' : 'down';
    return `spark-fill-${direction}-${hashSparklineValues(this.values)}`;
  }

  public get fillUrl(): string {
    return `url(#${this.gradientId})`;
  }

  public get linePath(): string {
    return buildSmoothPath(
      toSparklinePoints(this.values, this.width, this.height)
    );
  }

  public get areaPath(): string {
    const points = toSparklinePoints(this.values, this.width, this.height);
    if (points.length === 0) {
      return '';
    }
    const first = points[0];
    const last = points[points.length - 1];
    return `${this.linePath} L${last.x.toFixed(2)} ${this.height} L${first.x.toFixed(2)} ${this.height} Z`;
  }

  public get viewBox(): string {
    return `0 0 ${this.width} ${this.height}`;
  }
}
