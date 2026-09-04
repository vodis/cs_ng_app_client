export type SparklinePoint = { x: number; y: number };

export function buildSmoothPath(points: SparklinePoint[]): string {
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
  values: number[],
  width: number,
  height: number
): SparklinePoint[] {
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

export function hashSparklineValues(values: number[]): string {
  let hash = values.length;
  for (const value of values) {
    hash = (hash * 31 + Math.round(value * 1000)) >>> 0;
  }
  return hash.toString(36);
}
