/// <reference types="jasmine" />

import {
  buildSmoothPath,
  buildSparklinePaths,
  mockActivityVolumeSeries,
  toSparklinePoints,
} from './sparkline.utils';

describe('sparkline.utils', () => {
  it('builds a Catmull–Rom cubic path', () => {
    const path = buildSmoothPath([
      { x: 0, y: 10 },
      { x: 10, y: 4 },
      { x: 20, y: 8 },
    ]);

    expect(path.startsWith('M0.00 10.00')).toBeTrue();
    expect(path).toContain(' C');
    expect(path).toContain('20.00 8.00');
  });

  it('maps the lowest value to the bottom of the chart', () => {
    const points = toSparklinePoints([0, 50, 100], 100, 50);

    expect(points[0].y).toBeGreaterThan(points[2].y);
    expect(points[0].x).toBe(0);
    expect(points[2].x).toBe(100);
  });

  it('closes the area under a smooth line', () => {
    const paths = buildSparklinePaths([0, 12, 8, 20], 120, 40);

    expect(paths.line).toContain(' C');
    expect(paths.fill.startsWith(paths.line)).toBeTrue();
    expect(paths.fill.endsWith('Z')).toBeTrue();
  });

  it('starts mock volume at 0 and pins the last close', () => {
    const series = mockActivityVolumeSeries(978.51, 4021);

    expect(series.length).toBe(168);
    expect(series[0]).toBe(0);
    expect(series[series.length - 1]).toBe(978.51);
    expect(Math.max(...series)).toBeGreaterThan(978.51 * 0.5);
  });
});
