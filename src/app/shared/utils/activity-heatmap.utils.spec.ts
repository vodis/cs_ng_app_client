/// <reference types="jasmine" />

import {
  ACTIVITY_MONTH_LABEL_MIN_WEEK_GAP,
  activityDayLevel,
  activityHeatmapSwapCount,
  activityHeatmapYears,
  activityMonthBounds,
  activityMonthLabels,
  activityYearMonthFromIso,
  buildActivityHeatmap,
  buildActivityHeatmapForMonth,
  buildActivityHeatmapForYear,
  clampActivityYearMonth,
  compareActivityYearMonth,
  formatActivityDayDetail,
  formatActivityDayTooltip,
  formatActivityMonthTitle,
  shiftActivityYearMonth,
} from './activity-heatmap.utils';

describe('activity-heatmap.utils', () => {
  const latestIsoDate = '2026-08-25';
  const exampleIsoDate = '2026-04-23';
  const countsForDate = (isoDate: string) =>
    isoDate === exampleIsoDate
      ? { swaps: 5, deposits: 1, volumeUsd: 72.85 }
      : { swaps: 0, deposits: 0, volumeUsd: 0 };

  it('builds a 53-week Sunday-start heatmap covering one year', () => {
    const weeks = buildActivityHeatmap(latestIsoDate, undefined, countsForDate);
    const inRangeDays = weeks
      .flatMap(week => week.days)
      .filter(day => day.inRange);

    expect(weeks.length).toBe(53);
    expect(weeks[0].days.length).toBe(7);
    expect(inRangeDays.length).toBe(365);
    expect(inRangeDays[0].isoDate).toBe('2025-08-26');
    expect(inRangeDays[inRangeDays.length - 1].isoDate).toBe('2026-08-25');
  });

  it('pins the example day to 5 swaps and 1 deposit', () => {
    const weeks = buildActivityHeatmap(latestIsoDate, undefined, countsForDate);
    const example = weeks
      .flatMap(week => week.days)
      .find(day => day.isoDate === exampleIsoDate);

    expect(example).toBeDefined();
    if (!example) {
      fail('example heatmap day was missing');
      return;
    }

    expect(example.swaps).toBe(5);
    expect(example.deposits).toBe(1);
    expect(example.volumeUsd).toBe(72.85);
    expect(example.level).toBe(3);
    expect(formatActivityDayTooltip(example)).toBe(
      '5 swaps and 1 deposit on Apr 23, 2026'
    );
    expect(formatActivityDayDetail(example)).toBe(
      'Apr 23, 2026 · $72.85 · 5 swaps'
    );
  });

  it('maps totals onto GitHub-style intensity levels', () => {
    expect(activityDayLevel(0, 0)).toBe(0);
    expect(activityDayLevel(1, 0)).toBe(1);
    expect(activityDayLevel(2, 1)).toBe(2);
    expect(activityDayLevel(5, 1)).toBe(3);
    expect(activityDayLevel(8, 2)).toBe(4);
  });

  it('labels months with enough spacing to avoid collisions', () => {
    const weeks = buildActivityHeatmap(latestIsoDate, undefined, countsForDate);
    const months = activityMonthLabels(weeks);
    const dense = activityMonthLabels(weeks, 1);

    expect(months.length).toBeGreaterThan(6);
    expect(months[0].label).toBe('Aug');
    expect(months.some(month => month.label === 'Apr')).toBeTrue();
    expect(activityHeatmapSwapCount(weeks)).toBeGreaterThan(0);

    for (let index = 1; index < months.length; index += 1) {
      expect(
        months[index].weekIndex - months[index - 1].weekIndex
      ).toBeGreaterThanOrEqual(ACTIVITY_MONTH_LABEL_MIN_WEEK_GAP);
    }

    expect(dense.length).toBeGreaterThanOrEqual(months.length);
  });

  it('lists recent years and builds a calendar year when a past year is selected', () => {
    expect(activityHeatmapYears(latestIsoDate)).toEqual([2026, 2025, 2024]);

    const weeks = buildActivityHeatmapForYear(
      2025,
      latestIsoDate,
      countsForDate
    );
    const inRangeDays = weeks
      .flatMap(week => week.days)
      .filter(day => day.inRange);

    expect(inRangeDays[0].isoDate).toBe('2025-01-01');
    expect(inRangeDays[inRangeDays.length - 1].isoDate).toBe('2025-12-31');
    expect(inRangeDays.length).toBe(365);
  });

  it('keeps the current calendar year through Dec with empty days after latest', () => {
    const weeks = buildActivityHeatmapForYear(
      2026,
      latestIsoDate,
      countsForDate
    );
    const inRangeDays = weeks
      .flatMap(week => week.days)
      .filter(day => day.inRange);
    const months = activityMonthLabels(weeks, 1);
    const afterLatest = inRangeDays.filter(day => day.isoDate > latestIsoDate);

    expect(inRangeDays[0].isoDate).toBe('2026-01-01');
    expect(inRangeDays[inRangeDays.length - 1].isoDate).toBe('2026-12-31');
    expect(afterLatest.length).toBeGreaterThan(0);
    expect(
      afterLatest.every(day => day.swaps === 0 && day.level === 0)
    ).toBeTrue();
    expect(months.map(month => month.label)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]);
  });

  it('builds a single-month calendar clamped to the data window', () => {
    const weeks = buildActivityHeatmapForMonth(
      { year: 2026, month: 3 },
      '2024-01-01',
      latestIsoDate,
      countsForDate
    );
    const inRangeDays = weeks
      .flatMap(week => week.days)
      .filter(day => day.inRange);
    const example = inRangeDays.find(day => day.isoDate === exampleIsoDate);

    expect(weeks.length).toBeGreaterThanOrEqual(4);
    expect(weeks.length).toBeLessThanOrEqual(6);
    expect(inRangeDays[0].isoDate).toBe('2026-04-01');
    expect(inRangeDays[inRangeDays.length - 1].isoDate).toBe('2026-04-30');
    expect(example?.swaps).toBe(5);
    expect(example?.volumeUsd).toBe(72.85);
  });

  it('clamps and shifts month navigation across year boundaries', () => {
    const bounds = activityMonthBounds('2024-01-01', latestIsoDate);
    expect(bounds.min).toEqual({ year: 2024, month: 0 });
    expect(bounds.max).toEqual(activityYearMonthFromIso(latestIsoDate));
    expect(formatActivityMonthTitle(bounds.max)).toBe('August 2026');

    const next = shiftActivityYearMonth({ year: 2025, month: 11 }, 1);
    expect(next).toEqual({ year: 2026, month: 0 });
    expect(compareActivityYearMonth(next, bounds.max)).toBeLessThan(0);
    expect(
      clampActivityYearMonth({ year: 2027, month: 0 }, bounds.min, bounds.max)
    ).toEqual(bounds.max);
  });
});
