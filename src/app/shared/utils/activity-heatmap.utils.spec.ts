/// <reference types="jasmine" />

import {
  activityDayLevel,
  activityHeatmapSwapCount,
  activityHeatmapYears,
  activityMonthLabels,
  formatActivityDayTooltip,
  MOCK_ACTIVITY_EXAMPLE_DATE,
  mockActivityHeatmap,
  mockActivityHeatmapForYear,
} from './activity-heatmap.utils';

describe('activity-heatmap.utils', () => {
  it('builds a 53-week Sunday-start heatmap covering one year', () => {
    const weeks = mockActivityHeatmap();
    const inRangeDays = weeks.flatMap(week => week.days).filter(day => day.inRange);

    expect(weeks.length).toBe(53);
    expect(weeks[0].days.length).toBe(7);
    expect(inRangeDays.length).toBe(365);
    expect(inRangeDays[0].isoDate).toBe('2025-08-26');
    expect(inRangeDays[inRangeDays.length - 1].isoDate).toBe('2026-08-25');
  });

  it('pins the example day to 5 swaps and 1 deposit', () => {
    const weeks = mockActivityHeatmap();
    const example = weeks
      .flatMap(week => week.days)
      .find(day => day.isoDate === MOCK_ACTIVITY_EXAMPLE_DATE);

    expect(example).toBeDefined();
    if (!example) {
      fail('example heatmap day was missing');
      return;
    }

    expect(example.swaps).toBe(5);
    expect(example.deposits).toBe(1);
    expect(example.level).toBe(3);
    expect(formatActivityDayTooltip(example)).toBe(
      '5 swaps and 1 deposit on Apr 23, 2026'
    );
  });

  it('maps totals onto GitHub-style intensity levels', () => {
    expect(activityDayLevel(0, 0)).toBe(0);
    expect(activityDayLevel(1, 0)).toBe(1);
    expect(activityDayLevel(2, 1)).toBe(2);
    expect(activityDayLevel(5, 1)).toBe(3);
    expect(activityDayLevel(8, 2)).toBe(4);
  });

  it('labels months and sums swaps across the year', () => {
    const weeks = mockActivityHeatmap();
    const months = activityMonthLabels(weeks);

    expect(months.length).toBeGreaterThan(6);
    expect(months[0].label).toBe('Aug');
    expect(months.some(month => month.label === 'Apr')).toBeTrue();
    expect(activityHeatmapSwapCount(weeks)).toBeGreaterThan(0);
  });

  it('lists recent years and builds a calendar year when a past year is selected', () => {
    expect(activityHeatmapYears()).toEqual([2026, 2025, 2024]);

    const weeks = mockActivityHeatmapForYear(2025);
    const inRangeDays = weeks.flatMap(week => week.days).filter(day => day.inRange);

    expect(inRangeDays[0].isoDate).toBe('2025-01-01');
    expect(inRangeDays[inRangeDays.length - 1].isoDate).toBe('2025-12-31');
    expect(inRangeDays.length).toBe(365);
  });
});
