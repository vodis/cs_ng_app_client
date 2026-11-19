export type ActivityHeatmapLevel = 0 | 1 | 2 | 3 | 4;

export type ActivityHeatmapDay = {
  isoDate: string;
  swaps: number;
  deposits: number;
  volumeUsd: number;
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

export type ActivityYearMonth = {
  year: number;
  /** 0–11, UTC calendar month */
  month: number;
};

export type ActivityCounts = {
  swaps: number;
  deposits: number;
  volumeUsd?: number;
};
export type ActivityCountsProvider = (isoDate: string) => ActivityCounts;

export const ACTIVITY_HEATMAP_WEEKDAY_LABELS = [
  '',
  'Mon',
  '',
  'Wed',
  '',
  'Fri',
  '',
] as const;

/** Compact Sunday→Saturday headers for the mobile month grid. */
export const ACTIVITY_MONTH_WEEKDAY_LABELS = [
  'S',
  'M',
  'T',
  'W',
  'T',
  'F',
  'S',
] as const;

export const ACTIVITY_HEATMAP_YEAR_SPAN_DAYS = 365;
export const ACTIVITY_HEATMAP_YEAR_COUNT = 3;
/** Skip month labels closer than this many week columns (1-based indexes). */
export const ACTIVITY_MONTH_LABEL_MIN_WEEK_GAP = 2;

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

const MONTH_TITLES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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

function emptyCounts(): ActivityCounts {
  return { swaps: 0, deposits: 0, volumeUsd: 0 };
}

function dayFromCounts(
  isoDate: string,
  inRange: boolean,
  counts: ActivityCounts
): ActivityHeatmapDay {
  const swaps = inRange ? counts.swaps : 0;
  const deposits = inRange ? counts.deposits : 0;
  const volumeUsd = inRange ? (counts.volumeUsd ?? 0) : 0;
  return {
    isoDate,
    swaps,
    deposits,
    volumeUsd,
    level: activityDayLevel(swaps, deposits),
    inRange,
  };
}

export function activityDayLevel(
  swaps: number,
  deposits: number
): ActivityHeatmapLevel {
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

export function formatActivityDayDetail(day: ActivityHeatmapDay): string {
  if (!day.inRange) {
    return '';
  }

  const date = parseIsoDate(day.isoDate);
  const pretty = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  if (day.swaps === 0 && day.volumeUsd <= 0) {
    return `No activity on ${pretty}`;
  }

  const swapLabel = day.swaps === 1 ? '1 swap' : `${day.swaps} swaps`;
  return `${pretty} · $${day.volumeUsd.toFixed(2)} · ${swapLabel}`;
}

export function activityMonthLabels(
  weeks: readonly ActivityHeatmapWeek[],
  minWeekGap = ACTIVITY_MONTH_LABEL_MIN_WEEK_GAP
): ActivityMonthLabel[] {
  const labels: ActivityMonthLabel[] = [];
  let lastWeekIndex = Number.NEGATIVE_INFINITY;

  const firstInRange = weeks
    .flatMap((week, weekIndex) => week.days.map(day => ({ day, weekIndex })))
    .find(item => item.day.inRange);

  if (
    firstInRange &&
    parseIsoDate(firstInRange.day.isoDate).getUTCDate() !== 1
  ) {
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

  if (minWeekGap <= 1) {
    return labels;
  }

  const spaced: ActivityMonthLabel[] = [];
  let lastPlacedWeek = Number.NEGATIVE_INFINITY;
  for (const label of labels) {
    if (spaced.length > 0 && label.weekIndex - lastPlacedWeek < minWeekGap) {
      continue;
    }
    spaced.push(label);
    lastPlacedWeek = label.weekIndex;
  }
  return spaced;
}

export function activityHeatmapYears(
  latestIsoDate: string,
  yearCount = ACTIVITY_HEATMAP_YEAR_COUNT
): number[] {
  const latestYear = parseIsoDate(latestIsoDate).getUTCFullYear();
  return Array.from({ length: yearCount }, (_, index) => latestYear - index);
}

export function activityYearMonthFromIso(isoDate: string): ActivityYearMonth {
  const date = parseIsoDate(isoDate);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function compareActivityYearMonth(
  left: ActivityYearMonth,
  right: ActivityYearMonth
): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }
  return left.month - right.month;
}

export function shiftActivityYearMonth(
  value: ActivityYearMonth,
  deltaMonths: number
): ActivityYearMonth {
  const absolute = value.year * 12 + value.month + deltaMonths;
  const year = Math.floor(absolute / 12);
  const month = ((absolute % 12) + 12) % 12;
  return { year, month };
}

export function clampActivityYearMonth(
  value: ActivityYearMonth,
  min: ActivityYearMonth,
  max: ActivityYearMonth
): ActivityYearMonth {
  if (compareActivityYearMonth(value, min) < 0) {
    return min;
  }
  if (compareActivityYearMonth(value, max) > 0) {
    return max;
  }
  return value;
}

export function formatActivityMonthTitle(value: ActivityYearMonth): string {
  return `${MONTH_TITLES[value.month]} ${value.year}`;
}

export function activityMonthBounds(
  earliestIsoDate: string,
  latestIsoDate: string
): { min: ActivityYearMonth; max: ActivityYearMonth } {
  return {
    min: activityYearMonthFromIso(earliestIsoDate),
    max: activityYearMonthFromIso(latestIsoDate),
  };
}

export function buildActivityHeatmap(
  endIsoDate: string,
  startIsoDate: string | undefined,
  countsForDate: ActivityCountsProvider,
  options?: { activeEndIsoDate?: string }
): ActivityHeatmapWeek[] {
  const end = parseIsoDate(endIsoDate);
  const activeEnd = options?.activeEndIsoDate
    ? parseIsoDate(options.activeEndIsoDate)
    : end;
  const yearStart = startIsoDate
    ? parseIsoDate(startIsoDate)
    : addUtcDays(end, -(ACTIVITY_HEATMAP_YEAR_SPAN_DAYS - 1));
  const startSunday = startOfSundayUtc(yearStart);
  const endSunday = startOfSundayUtc(end);
  const weekCount =
    Math.round(
      (endSunday.getTime() - startSunday.getTime()) / (7 * 86_400_000)
    ) + 1;
  const weeks: ActivityHeatmapWeek[] = [];

  for (let week = 0; week < weekCount; week += 1) {
    const days: ActivityHeatmapDay[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = addUtcDays(startSunday, week * 7 + weekday);
      const isoDate = toIsoDate(date);
      // Calendar membership (Jan–Dec for year grids). Days after activeEnd stay
      // visible as empty cells so month labels and the year outline match.
      const inRange =
        date.getTime() >= yearStart.getTime() &&
        date.getTime() <= end.getTime();
      const isActive = date.getTime() <= activeEnd.getTime();
      const counts =
        inRange && isActive ? countsForDate(isoDate) : emptyCounts();
      days.push(dayFromCounts(isoDate, inRange, counts));
    }
    weeks.push({ days });
  }

  return weeks;
}

/** Full Jan–Dec calendar year; days after `latestIsoDate` stay empty/disabled. */
export function buildActivityHeatmapForYear(
  year: number,
  latestIsoDate: string,
  countsForDate: ActivityCountsProvider
): ActivityHeatmapWeek[] {
  const startIsoDate = toIsoDate(new Date(Date.UTC(year, 0, 1)));
  const endIsoDate = toIsoDate(new Date(Date.UTC(year, 11, 31)));
  return buildActivityHeatmap(endIsoDate, startIsoDate, countsForDate, {
    activeEndIsoDate: latestIsoDate,
  });
}

/**
 * Sunday-start calendar weeks for a single UTC month.
 * Days outside the month or outside [earliest, latest] are `inRange: false`.
 */
export function buildActivityHeatmapForMonth(
  yearMonth: ActivityYearMonth,
  earliestIsoDate: string,
  latestIsoDate: string,
  countsForDate: ActivityCountsProvider
): ActivityHeatmapWeek[] {
  const earliest = parseIsoDate(earliestIsoDate);
  const latest = parseIsoDate(latestIsoDate);
  const monthStart = new Date(Date.UTC(yearMonth.year, yearMonth.month, 1));
  const monthEnd = new Date(
    Date.UTC(yearMonth.year, yearMonth.month + 1, 0, 0, 0, 0, 0)
  );
  const startSunday = startOfSundayUtc(monthStart);
  const endSunday = startOfSundayUtc(monthEnd);
  const weekCount =
    Math.round(
      (endSunday.getTime() - startSunday.getTime()) / (7 * 86_400_000)
    ) + 1;
  const weeks: ActivityHeatmapWeek[] = [];

  for (let week = 0; week < weekCount; week += 1) {
    const days: ActivityHeatmapDay[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = addUtcDays(startSunday, week * 7 + weekday);
      const isoDate = toIsoDate(date);
      const inMonth =
        date.getUTCFullYear() === yearMonth.year &&
        date.getUTCMonth() === yearMonth.month;
      const inWindow =
        date.getTime() >= earliest.getTime() &&
        date.getTime() <= latest.getTime();
      const inRange = inMonth && inWindow;
      const counts = inRange ? countsForDate(isoDate) : emptyCounts();
      days.push(dayFromCounts(isoDate, inRange, counts));
    }
    weeks.push({ days });
  }

  return weeks;
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
