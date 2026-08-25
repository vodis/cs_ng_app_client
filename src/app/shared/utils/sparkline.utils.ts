export type SparklinePoint = {
  x: number;
  y: number;
};

export type SparklinePaths = {
  line: string;
  fill: string;
};

const DEFAULT_VOLUME_POINTS = 168;
const DEFAULT_VOLUME_END = 978.51;
const DEFAULT_VOLUME_SEED = 4021;

/** Catmull–Rom → cubic Bézier, matching the wallets MFE sparkline. */
export function buildSmoothPath(points: readonly SparklinePoint[]): string {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  let path = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

export function toSparklinePoints(
  values: readonly number[],
  width: number,
  height: number
): SparklinePoint[] {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = height * 0.12;
  const usableHeight = height - padY * 2;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: index * stepX,
    y: padY + usableHeight - ((value - min) / range) * usableHeight,
  }));
}

export function buildSparklinePaths(
  values: readonly number[],
  width: number,
  height: number
): SparklinePaths {
  const points = toSparklinePoints(values, width, height);
  if (points.length === 0) {
    return { line: '', fill: '' };
  }

  const line = buildSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];

  return {
    line,
    fill: `${line} L${last.x.toFixed(2)} ${height} L${first.x.toFixed(2)} ${height} Z`,
  };
}

/**
 * Deterministic 7d-style volume series (hourly), same layered-wave approach as
 * `mockSparkline7d` in cs_mfe-wallets. Starts at 0 and pins the last close.
 */
export function mockActivityVolumeSeries(
  endValue = DEFAULT_VOLUME_END,
  seed = DEFAULT_VOLUME_SEED
): number[] {
  const points = DEFAULT_VOLUME_POINTS;
  let state = (Math.abs(seed) * 9973 + 13) % 2147483647 || 1;
  const rand = (): number => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
  const phase = (seed % 97) / 97;
  const series: number[] = [];

  for (let i = 0; i < points; i += 1) {
    const t = i / (points - 1);
    const trend = endValue * t;
    const swing =
      Math.sin((t + phase) * Math.PI * 2.1) * (endValue * 0.085) +
      Math.sin((t + phase * 0.7) * Math.PI * 5.4) * (endValue * 0.045) +
      Math.sin((t * 2 + phase) * Math.PI * 9.5) * (endValue * 0.02);
    const noise = (rand() - 0.5) * (endValue * 0.018);
    series.push(Math.max(0, trend + swing + noise));
  }

  series[0] = 0;
  series[points - 1] = endValue;
  return series.map(value => Number(value.toFixed(4)));
}
