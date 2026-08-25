/// <reference types="jasmine" />

import { activityHeatmapSwapCount } from '@shared/utils/activity-heatmap.utils';
import {
  MockProfileActivitySource,
  PROFILE_ACTIVITY_EXAMPLE_DATE,
} from './profile-activity.source';

describe('MockProfileActivitySource', () => {
  const source = new MockProfileActivitySource();

  it('uses one swap count for activity and onboarding', () => {
    const snapshot = source.snapshot();

    expect(snapshot.completedSwapCount).toBe(
      activityHeatmapSwapCount(snapshot.weeks)
    );
  });

  it('provides deterministic snapshots through the replaceable source boundary', () => {
    const snapshot = source.snapshot(2025);
    const days = snapshot.weeks
      .flatMap(week => week.days)
      .filter(day => day.inRange);

    expect(snapshot.selectedYear).toBe(2025);
    expect(days[0].isoDate).toBe('2025-01-01');
    expect(days[days.length - 1].isoDate).toBe('2025-12-31');
    expect(source.snapshot().weeks.flatMap(week => week.days)).toContain(
      jasmine.objectContaining({ isoDate: PROFILE_ACTIVITY_EXAMPLE_DATE })
    );
  });
});
