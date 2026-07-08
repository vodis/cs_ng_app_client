import type { LivelineSeries } from 'liveline';
import { MarketOverviewChartComponent } from './market-overview-chart.component';

describe('MarketOverviewChartComponent reference line selection', () => {
  let component: MarketOverviewChartComponent;

  beforeEach(() => {
    component = new MarketOverviewChartComponent();
  });

  it('does not pin zero baseline for positive-only datasets far from zero', () => {
    const input = buildSeries('positive', [6.4, 7.1, 8.2, 8.9]);

    const line = (component as any).referenceLineForSeries(input);

    expect(line).toBeUndefined();
  });

  it('does not pin zero baseline for negative-only datasets far from zero', () => {
    const input = buildSeries('negative', [-9.3, -8.7, -7.9, -7.2]);

    const line = (component as any).referenceLineForSeries(input);

    expect(line).toBeUndefined();
  });

  it('keeps zero baseline when the dataset crosses zero', () => {
    const input = buildSeries('crossing', [-1.2, -0.3, 0.4, 1.1]);

    const line = (component as any).referenceLineForSeries(input);

    expect(line).toEqual({ value: 0, label: '0%' });
  });

  it('ignores non-finite values and returns undefined without finite points', () => {
    const input = buildSeries('non-finite', [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]);

    const line = (component as any).referenceLineForSeries(input);

    expect(line).toBeUndefined();
  });
});

function buildSeries(id: string, values: number[]): LivelineSeries[] {
  return [
    {
      id,
      label: id.toUpperCase(),
      color: '#fe6c00',
      value: values[values.length - 1] ?? 0,
      data: values.map((value, index) => ({
        time: 1_700_000_000 + index * 60,
        value,
      })),
    },
  ];
}
