export type ActivityHeatmapLevel = 0 | 1 | 2 | 3 | 4;

export type ActivityHeatmapDay = {
  isoDate: string;
  swaps: number;
  deposits: number;
  level: ActivityHeatmapLevel;
  inRange: boolean;
};

export type ActivityHeatmapWeek = {
  days: ActivityHeatmapDay[];
};

export type ActivityMonthLabel = {
  label: string;
  weekIndex: number;
};

export const ACTIVITY_HEATMAP_WEEKDAY_LABELS = [
  '',
  'Mon',
  '',
  'Wed',
  '',
  'Fri',
  '',
] as const;

export const MOCK_ACTIVITY_HEATMAP_END = '2026-08-25';
export const MOCK_ACTIVITY_EXAMPLE_DATE = '2026-04-23';
export const ACTIVITY_HEATMAP_YEAR_SPAN_DAYS = 365;
export const ACTIVITY_HEATMAP_YEAR_COUNT = 3;

const MONTH_LABELS = [
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
] as const;

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfSundayUtc(date: Date): Date {
  const start = new Date(date.getTime());
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function hashIsoDate(isoDate: string): number {
  let hash = 2166136261;
  for (let i = 0; i < isoDate.length; i += 1) {
    hash = Math.imul(hash ^ isoDate.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

export function activityDayLevel(swaps: number, deposits: number): ActivityHeatmapLevel {
  const total = swaps + deposits;
  if (total <= 0) {
    return 0;
  }
  if (total === 1) {
    return 1;
  }
  if (total <= 3) {
    return 2;
  }
  if (total <= 6) {
    return 3;
  }
  return 4;
}

function mockCountsForDate(isoDate: string): { swaps: number; deposits: number } {
  if (isoDate === MOCK_ACTIVITY_EXAMPLE_DATE) {
    return { swaps: 5, deposits: 1 };
  }

  const hash = hashIsoDate(isoDate);
  const roll = hash % 100;
  if (roll < 48) {
    return { swaps: 0, deposits: 0 };
  }

  const swaps = (hash % 6) + 1;
  const deposits = roll > 82 ? (hash % 3) + 1 : roll > 70 ? 1 : 0;
  return { swaps, deposits };
}

export function formatActivityDayTooltip(day: ActivityHeatmapDay): string {
  const date = parseIsoDate(day.isoDate);
  const pretty = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  if (!day.inRange) {
    return '';
  }

  if (day.swaps === 0 && day.deposits === 0) {
    return `No activity on ${pretty}`;
  }

  const parts: string[] = [];
  if (day.swaps > 0) {
    parts.push(day.swaps === 1 ? '1 swap' : `${day.swaps} swaps`);
  }
  if (day.deposits > 0) {
    parts.push(day.deposits === 1 ? '1 deposit' : `${day.deposits} deposits`);
  }

  return `${parts.join(' and ')} on ${pretty}`;
}

export function activityMonthLabels(
  weeks: readonly ActivityHeatmapWeek[]
): ActivityMonthLabel[] {
  const labels: ActivityMonthLabel[] = [];
  let lastWeekIndex = Number.NEGATIVE_INFINITY;

  const firstInRange = weeks
    .flatMap((week, weekIndex) =>
      week.days.map(day => ({ day, weekIndex }))
    )
    .find(item => item.day.inRange);

  if (firstInRange && parseIsoDate(firstInRange.day.isoDate).getUTCDate() !== 1) {
    labels.push({
      label: MONTH_LABELS[parseIsoDate(firstInRange.day.isoDate).getUTCMonth()],
      weekIndex: firstInRange.weekIndex + 1,
    });
    lastWeekIndex = firstInRange.weekIndex;
  }

  weeks.forEach((week, weekIndex) => {
    const monthStart = week.days.find(
      day => day.inRange && parseIsoDate(day.isoDate).getUTCDate() === 1
    );
    if (!monthStart || weekIndex === lastWeekIndex) {
      return;
    }

    labels.push({
      label: MONTH_LABELS[parseIsoDate(monthStart.isoDate).getUTCMonth()],
      weekIndex: weekIndex + 1,
    });
    lastWeekIndex = weekIndex;
  });

  return labels;
}

export function activityHeatmapYears(
  latestIsoDate = MOCK_ACTIVITY_HEATMAP_END,
  yearCount = ACTIVITY_HEATMAP_YEAR_COUNT
): number[] {
  const latestYear = parseIsoDate(latestIsoDate).getUTCFullYear();
  return Array.from({ length: yearCount }, (_, index) => latestYear - index);
}

export function mockActivityHeatmap(
  endIsoDate = MOCK_ACTIVITY_HEATMAP_END,
  startIsoDate?: string
): ActivityHeatmapWeek[] {
  const end = parseIsoDate(endIsoDate);
  const yearStart = startIsoDate
    ? parseIsoDate(startIsoDate)
    : addUtcDays(end, -(ACTIVITY_HEATMAP_YEAR_SPAN_DAYS - 1));
  const startSunday = startOfSundayUtc(yearStart);
  const endSunday = startOfSundayUtc(end);
  const weekCount =
    Math.round((endSunday.getTime() - startSunday.getTime()) / (7 * 86_400_000)) +
    1;
  const weeks: ActivityHeatmapWeek[] = [];

  for (let week = 0; week < weekCount; week += 1) {
    const days: ActivityHeatmapDay[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = addUtcDays(startSunday, week * 7 + weekday);
      const isoDate = toIsoDate(date);
      const inRange =
        date.getTime() >= yearStart.getTime() && date.getTime() <= end.getTime();
      const counts = inRange
        ? mockCountsForDate(isoDate)
        : { swaps: 0, deposits: 0 };

      days.push({
        isoDate,
        swaps: counts.swaps,
        deposits: counts.deposits,
        level: activityDayLevel(counts.swaps, counts.deposits),
        inRange,
      });
    }
    weeks.push({ days });
  }

  return weeks;
}

export function mockActivityHeatmapForYear(
  year: number,
  latestIsoDate = MOCK_ACTIVITY_HEATMAP_END
): ActivityHeatmapWeek[] {
  const latest = parseIsoDate(latestIsoDate);
  const latestYear = latest.getUTCFullYear();

  if (year >= latestYear) {
    return mockActivityHeatmap(latestIsoDate);
  }

  const startIsoDate = toIsoDate(new Date(Date.UTC(year, 0, 1)));
  const endIsoDate = toIsoDate(new Date(Date.UTC(year, 11, 31)));
  return mockActivityHeatmap(endIsoDate, startIsoDate);
}

export function activityHeatmapSwapCount(
  weeks: readonly ActivityHeatmapWeek[]
): number {
  return weeks.reduce(
    (total, week) =>
      total +
      week.days.reduce(
        (weekTotal, day) => weekTotal + (day.inRange ? day.swaps : 0),
        0
      ),
    0
  );
}
