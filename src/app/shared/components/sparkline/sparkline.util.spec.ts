/// <reference types="jasmine" />

import { buildSmoothPath, toSparklinePoints } from './sparkline.util';

describe('sparkline.util', () => {
  it('builds a smooth path from two or more points', () => {
    const points = toSparklinePoints([10, 20, 15], 96, 32);
    const path = buildSmoothPath(points);

    expect(points.length).toBe(3);
    expect(path.startsWith('M')).toBeTrue();
    expect(path).toContain('C');
  });
});
