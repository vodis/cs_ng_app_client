import { Injectable } from '@angular/core';
import {
  ACTIVITY_HEATMAP_WEEKDAY_LABELS,
  activityHeatmapSwapCount,
  activityHeatmapYears,
  activityMonthLabels,
  buildActivityHeatmapForYear,
  type ActivityCounts,
  type ActivityHeatmapWeek,
  type ActivityMonthLabel,
} from '@shared/utils/activity-heatmap.utils';

export type ProfileActivitySnapshot = {
  volumeUsd: number;
  fiatUsd: number;
  todayDeltaUsd: number;
  todayPercent: number;
  completedSwapCount: number;
  years: readonly number[];
  weekdays: typeof ACTIVITY_HEATMAP_WEEKDAY_LABELS;
  selectedYear: number;
  weeks: readonly ActivityHeatmapWeek[];
  months: readonly ActivityMonthLabel[];
};

export abstract class ProfileActivitySource {
  public abstract snapshot(year?: number): ProfileActivitySnapshot;
}

export const PROFILE_ACTIVITY_EXAMPLE_DATE = '2026-04-23';

@Injectable()
export class MockProfileActivitySource extends ProfileActivitySource {
  private static readonly latestIsoDate = '2026-08-25';
  private static readonly volumeUsd = 978.51;
  private static readonly fiatUsd = 978.66;
  private static readonly todayDeltaUsd = 17.98;
  private static readonly todayPercent = 1.87;

  private countsForDate(isoDate: string): ActivityCounts {
    if (isoDate === PROFILE_ACTIVITY_EXAMPLE_DATE) {
      return { swaps: 5, deposits: 1 };
    }

    let hash = 2166136261;
    for (let index = 0; index < isoDate.length; index += 1) {
      hash = Math.imul(hash ^ isoDate.charCodeAt(index), 16777619);
    }
    const normalizedHash = hash >>> 0;
    const roll = normalizedHash % 100;
    if (roll < 48) {
      return { swaps: 0, deposits: 0 };
    }

    return {
      swaps: (normalizedHash % 6) + 1,
      deposits: roll > 82 ? (normalizedHash % 3) + 1 : roll > 70 ? 1 : 0,
    };
  }

  public snapshot(year?: number): ProfileActivitySnapshot {
    const years = activityHeatmapYears(MockProfileActivitySource.latestIsoDate);
    const selectedYear = year ?? years[0];
    const weeks = buildActivityHeatmapForYear(
      selectedYear,
      MockProfileActivitySource.latestIsoDate,
      isoDate => this.countsForDate(isoDate)
    );

    return {
      volumeUsd: MockProfileActivitySource.volumeUsd,
      fiatUsd: MockProfileActivitySource.fiatUsd,
      todayDeltaUsd: MockProfileActivitySource.todayDeltaUsd,
      todayPercent: MockProfileActivitySource.todayPercent,
      completedSwapCount: activityHeatmapSwapCount(weeks),
      years,
      weekdays: ACTIVITY_HEATMAP_WEEKDAY_LABELS,
      selectedYear,
      weeks,
      months: activityMonthLabels(weeks),
    };
  }
}
