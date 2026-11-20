import { expect, test, type Page } from '@playwright/test';
import { useAuthenticatedSession } from './utils/auth-fixtures';

const SCREENSHOT_DIR = 'tmp/screenshots';
const DESKTOP_WIDTHS = [1280, 1440, 1920] as const;

async function openProfileActivity(page: Page): Promise<void> {
  await useAuthenticatedSession(page);
  await page.goto('/en/profile', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('region', { name: 'Activity' })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('Profile Activity layout', () => {
  for (const width of DESKTOP_WIDTHS) {
    test(`desktop activity layout at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openProfileActivity(page);

      const activity = page.getByRole('region', { name: 'Activity' });
      const yearHeatmap = activity.locator('.profile-shell__heatmap--year');
      const chart = yearHeatmap.locator('.profile-shell__heatmap-chart');
      const grid = yearHeatmap.locator('.profile-shell__heatmap-grid');
      const legend = yearHeatmap.locator('.profile-shell__heatmap-legend');
      const years = yearHeatmap.locator('.profile-shell__heatmap-years');
      const stats = activity.locator('.profile-shell__activity-stats');
      const title = activity.locator('.profile-shell__activity-title');
      const monthLabels = yearHeatmap
        .locator('.profile-shell__heatmap-month-slot')
        .filter({ hasText: /\S/ });

      await expect(title).toHaveText('Activity');
      await expect(activity.getByText('Est. swap volume')).toBeVisible();
      await expect(yearHeatmap.getByText('Swap activity')).toBeVisible();
      await expect(yearHeatmap).toBeVisible();
      await expect(
        activity.locator('.profile-shell__heatmap--month')
      ).toBeHidden();
      await expect(
        yearHeatmap.locator('.profile-shell__heatmap-year--active')
      ).toHaveText('2026');
      await expect(
        yearHeatmap.getByRole('button', { name: 'Newer years' })
      ).toBeDisabled();
      await expect(
        yearHeatmap.getByRole('button', { name: 'Older years' })
      ).toBeDisabled();
      await expect(monthLabels).toHaveCount(12);
      await expect(monthLabels).toHaveText([
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

      const metrics = await page.evaluate(() => {
        const panel = document.querySelector(
          '.profile-shell__panel--activity'
        ) as HTMLElement | null;
        const shell = document.querySelector(
          '.profile-shell'
        ) as HTMLElement | null;
        const activityEl = document.querySelector(
          '.profile-shell__activity'
        ) as HTMLElement | null;
        const titleEl = document.querySelector(
          '.profile-shell__activity-title'
        ) as HTMLElement | null;
        const statsEl = document.querySelector(
          '.profile-shell__activity-stats'
        ) as HTMLElement | null;
        const section = document.querySelector(
          '.profile-shell__heatmap--year'
        ) as HTMLElement | null;
        const blockEl = document.querySelector(
          '.profile-shell__heatmap-block'
        ) as HTMLElement | null;
        const chartEl = document.querySelector(
          '.profile-shell__heatmap-chart'
        ) as HTMLElement | null;
        const gridEl = document.querySelector(
          '.profile-shell__heatmap-grid'
        ) as HTMLElement | null;
        const legendEl = document.querySelector(
          '.profile-shell__heatmap-legend'
        ) as HTMLElement | null;
        const yearsEl = document.querySelector(
          '.profile-shell__heatmap-years'
        ) as HTMLElement | null;
        const dayEl = document.querySelector(
          '.profile-shell__heatmap--year .profile-shell__heatmap-grid .profile-shell__heatmap-day'
        ) as HTMLElement | null;
        const valueEl = document.querySelector(
          '.profile-shell__activity-value'
        ) as HTMLElement | null;
        const unitEl = document.querySelector(
          '.profile-shell__activity-unit'
        ) as HTMLElement | null;
        const labelEl = document.querySelector(
          '.profile-shell__activity-label'
        ) as HTMLElement | null;
        const headingEl = document.querySelector(
          '.profile-shell__heatmap-heading'
        ) as HTMLElement | null;
        const activeYearEl = document.querySelector(
          '.profile-shell__heatmap-year--active'
        ) as HTMLElement | null;
        const weekEls = Array.from(
          document.querySelectorAll(
            '.profile-shell__heatmap--year .profile-shell__heatmap-week'
          )
        ) as HTMLElement[];
        const monthEls = Array.from(
          document.querySelectorAll(
            '.profile-shell__heatmap--year .profile-shell__heatmap-month-slot'
          )
        ).filter(
          el => (el.textContent ?? '').trim().length > 0
        ) as HTMLElement[];
        const monthGapWeek = document.querySelector(
          '.profile-shell__heatmap--year .profile-shell__heatmap-week--month-start'
        ) as HTMLElement | null;

        if (
          !panel ||
          !shell ||
          !activityEl ||
          !titleEl ||
          !statsEl ||
          !section ||
          !blockEl ||
          !chartEl ||
          !gridEl ||
          !legendEl ||
          !yearsEl ||
          !dayEl ||
          !valueEl ||
          !unitEl ||
          !labelEl ||
          !headingEl ||
          !activeYearEl ||
          !monthGapWeek ||
          weekEls.length < 2 ||
          monthEls.length < 12
        ) {
          return null;
        }

        const panelBox = panel.getBoundingClientRect();
        const shellBox = shell.getBoundingClientRect();
        const shellStyle = getComputedStyle(shell);
        const shellPadX =
          Number.parseFloat(shellStyle.paddingLeft) +
          Number.parseFloat(shellStyle.paddingRight);
        const activityBox = activityEl.getBoundingClientRect();
        const titleBox = titleEl.getBoundingClientRect();
        const statsBox = statsEl.getBoundingClientRect();
        const sectionBox = section.getBoundingClientRect();
        const blockBox = blockEl.getBoundingClientRect();
        const chartBox = chartEl.getBoundingClientRect();
        const gridBox = gridEl.getBoundingClientRect();
        const legendBox = legendEl.getBoundingClientRect();
        const yearsBox = yearsEl.getBoundingClientRect();
        const dayBox = dayEl.getBoundingClientRect();
        const firstWeek = weekEls[0].getBoundingClientRect();
        const secondWeek = weekEls[1].getBoundingClientRect();
        const lastWeek = weekEls[weekEls.length - 1].getBoundingClientRect();
        const yearButtons = Array.from(
          yearsEl.querySelectorAll('.profile-shell__heatmap-year')
        ) as HTMLElement[];
        const yearButtonBoxes = yearButtons.map(btn =>
          btn.getBoundingClientRect()
        );
        const labelBox = labelEl.getBoundingClientRect();
        const headingBox = headingEl.getBoundingClientRect();
        const valueBox = valueEl.getBoundingClientRect();
        const unitBox = unitEl.getBoundingClientRect();
        const activeYearStyle = getComputedStyle(activeYearEl);
        const textBox = (el: HTMLElement): DOMRect => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getBoundingClientRect();
        };
        const monthTextBoxes = monthEls.map(textBox);
        const augIndex = monthEls.findIndex(
          el => el.textContent?.trim() === 'Aug'
        );
        const sepIndex = monthEls.findIndex(
          el => el.textContent?.trim() === 'Sep'
        );
        const augBox = augIndex >= 0 ? monthTextBoxes[augIndex] : null;
        const sepBox = sepIndex >= 0 ? monthTextBoxes[sepIndex] : null;

        return {
          activityWidth: activityBox.width,
          titleTop: titleBox.top,
          statsTop: statsBox.top,
          sectionTop: sectionBox.top,
          statsWidth: statsBox.width,
          sectionWidth: sectionBox.width,
          blockWidth: blockBox.width,
          blockRight: blockBox.right,
          chartWidth: chartBox.width,
          gridWidth: gridBox.width,
          gridRight: gridBox.right,
          legendRight: legendBox.right,
          legendTop: legendBox.top,
          gridBottom: gridBox.bottom,
          yearsLeft: yearsBox.left,
          yearsRight: yearsBox.right,
          yearButtonCount: yearButtons.length,
          yearsStacked:
            yearButtonBoxes.length >= 2 &&
            yearButtonBoxes.every((box, index) => {
              if (index === 0) {
                return true;
              }
              const prev = yearButtonBoxes[index - 1];
              return (
                box.top >= prev.bottom - 1 && Math.abs(box.left - prev.left) < 8
              );
            }),
          yearButtonsUniform:
            yearButtonBoxes.length >= 2 &&
            yearButtonBoxes.every(
              box =>
                Math.abs(box.width - yearButtonBoxes[0].width) < 1.5 &&
                Math.abs(box.height - yearButtonBoxes[0].height) < 1.5
            ),
          dayWidth: dayBox.width,
          dayHeight: dayBox.height,
          gridHeight: gridBox.height,
          valueFontSize: Number.parseFloat(getComputedStyle(valueEl).fontSize),
          titleFontSize: Number.parseFloat(getComputedStyle(titleEl).fontSize),
          statsPadLeft: Number.parseFloat(
            getComputedStyle(statsEl).paddingLeft
          ),
          panelPadLeft: Number.parseFloat(getComputedStyle(panel).paddingLeft),
          gutter: sectionBox.left - statsBox.right,
          panelWidth: panelBox.width,
          shellInnerWidth: shellBox.width - shellPadX,
          weekColumnGap: secondWeek.left - firstWeek.right,
          monthBoundaryGap: (() => {
            const gapIndex = weekEls.indexOf(monthGapWeek);
            if (gapIndex <= 0) {
              return Number.NaN;
            }
            return (
              weekEls[gapIndex].getBoundingClientRect().left -
              weekEls[gapIndex - 1].getBoundingClientRect().right
            );
          })(),
          lastWeekRight: lastWeek.right,
          sectionFillsRemainder:
            Math.abs(sectionBox.right - activityBox.right) < 4 &&
            Math.abs(yearsBox.right - sectionBox.right) < 4,
          chartPackedToYears:
            yearsBox.left - gridBox.right > 4 &&
            yearsBox.left - gridBox.right < 28,
          statsColumnRatio: statsBox.width / activityBox.width,
          labelHeadingTopDelta: Math.abs(labelBox.top - headingBox.top),
          statsLeftEdgeDelta: Math.abs(labelBox.left - valueBox.left),
          valueAlignItems: getComputedStyle(valueEl).alignItems,
          unitBesideAmount: unitBox.left > valueBox.left + 24,
          activeYearColor: activeYearStyle.color,
          activeYearBackground: activeYearStyle.backgroundColor,
          augSepGap: augBox && sepBox ? sepBox.left - augBox.right : Number.NaN,
          monthOverlapCount: monthTextBoxes.reduce((count, box, index) => {
            const next = monthTextBoxes[index + 1];
            if (!next) {
              return count;
            }
            return box.right > next.left + 1 ? count + 1 : count;
          }, 0),
        };
      });

      expect(metrics).not.toBeNull();
      if (!metrics) {
        return;
      }

      // Title sits above the two-column row.
      expect(metrics.titleTop).toBeLessThan(metrics.statsTop - 8);
      expect(Math.abs(metrics.statsTop - metrics.sectionTop)).toBeLessThan(24);

      // Card spans the dashboard content width (no max-width cap).
      expect(
        Math.abs(metrics.panelWidth - metrics.shellInnerWidth)
      ).toBeLessThan(8);

      // Square cells; week gap ~3px, larger pause between months.
      expect(Math.abs(metrics.dayWidth - metrics.dayHeight)).toBeLessThan(1.5);
      expect(metrics.dayWidth).toBeGreaterThanOrEqual(6);
      expect(metrics.dayWidth).toBeLessThanOrEqual(22);
      expect(metrics.weekColumnGap).toBeGreaterThanOrEqual(2);
      expect(metrics.weekColumnGap).toBeLessThanOrEqual(5);
      expect(metrics.monthBoundaryGap).toBeGreaterThan(
        metrics.weekColumnGap + 2
      );

      // Roomier stats; heatmap fills its column to the year carousel.
      expect(metrics.sectionFillsRemainder).toBe(true);
      expect(metrics.chartPackedToYears).toBe(true);
      expect(Math.abs(metrics.chartWidth - metrics.gridWidth)).toBeLessThan(8);
      expect(Math.abs(metrics.blockWidth - metrics.gridWidth)).toBeLessThan(8);
      expect(metrics.statsColumnRatio).toBeGreaterThan(0.22);
      expect(metrics.statsColumnRatio).toBeLessThan(0.4);
      expect(metrics.sectionWidth / metrics.activityWidth).toBeGreaterThan(0.5);
      expect(metrics.gutter).toBeGreaterThan(16);
      expect(metrics.gutter).toBeLessThan(48);
      expect(metrics.titleFontSize).toBeGreaterThanOrEqual(20);
      expect(metrics.statsPadLeft).toBeGreaterThanOrEqual(12);
      expect(metrics.panelPadLeft).toBeGreaterThanOrEqual(32);
      expect(metrics.valueFontSize).toBeGreaterThan(26);
      expect(metrics.valueFontSize).toBeLessThan(48);
      expect(metrics.labelHeadingTopDelta).toBeLessThan(4);
      expect(metrics.statsLeftEdgeDelta).toBeLessThan(2);
      expect(metrics.valueAlignItems).toBe('baseline');
      expect(metrics.unitBesideAmount).toBe(true);

      // Years sit in a uniform vertical column immediately after the grid.
      expect(metrics.yearButtonCount).toBe(3);
      expect(metrics.yearsStacked).toBe(true);
      expect(metrics.yearButtonsUniform).toBe(true);
      expect(metrics.yearsLeft - metrics.gridRight).toBeGreaterThan(4);
      expect(metrics.yearsLeft - metrics.gridRight).toBeLessThan(28);
      expect(Math.abs(metrics.legendRight - metrics.gridRight)).toBeLessThan(8);
      expect(Math.abs(metrics.lastWeekRight - metrics.gridRight)).toBeLessThan(
        8
      );
      expect(metrics.activeYearColor).toMatch(/254,\s*108,\s*0|fe6c00/i);
      expect(metrics.activeYearBackground).not.toMatch(
        /^rgb\(\s*254,\s*108,\s*0\s*\)$/i
      );

      // Legend sits immediately under the grid.
      expect(metrics.legendTop - metrics.gridBottom).toBeGreaterThanOrEqual(0);
      expect(metrics.legendTop - metrics.gridBottom).toBeLessThan(24);

      // Month labels stay readable (esp. Aug / Sep).
      expect(metrics.monthOverlapCount).toBe(0);
      expect(metrics.augSepGap).toBeGreaterThan(2);

      await expect(chart).toBeVisible();
      await expect(grid).toBeVisible();
      await expect(legend).toBeVisible();
      await expect(years).toBeVisible();
      await expect(stats).toBeVisible();

      await activity.screenshot({
        path: `${SCREENSHOT_DIR}/profile-activity-desktop-${width}.png`,
      });
    });
  }
});

test.describe('Profile Activity layout (mobile)', () => {
  const MOBILE_WIDTHS = [360, 390, 430] as const;

  test('mobile shows month navigation and grouped stats', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openProfileActivity(page);

    const activity = page.getByRole('region', { name: 'Activity' });
    const meta = activity.locator('.profile-shell__activity-meta');
    const monthName = activity.locator('.profile-shell__month-nav-month');
    const yearJump = activity.getByRole('button', {
      name: 'Jump to activity year',
    });
    const yearMenu = activity.getByRole('listbox', { name: 'Activity years' });

    await expect(
      activity.locator('.profile-shell__heatmap--year')
    ).toBeHidden();
    await expect(
      activity.locator('.profile-shell__heatmap--month')
    ).toBeVisible();
    await expect(monthName).toHaveText('November');
    await expect(
      activity.getByRole('button', { name: 'Next month' })
    ).toBeDisabled();
    await expect(
      activity.getByRole('button', { name: 'Previous month' })
    ).toBeEnabled();
    await expect(meta).toBeVisible();
    await expect(meta.locator('.profile-shell__activity-chip')).toHaveCount(3);
    await expect(yearJump).toContainText('2026');

    await activity.getByRole('button', { name: 'Previous month' }).click();
    await expect(monthName).toHaveText('October');
    await expect(yearJump).toContainText('2026');

    await yearJump.click();
    await expect(yearMenu).toBeVisible();
    await yearMenu.getByRole('option', { name: '2025' }).click();
    await expect(monthName).toHaveText('October');
    await expect(yearJump).toContainText('2025');

    // December ↔ January crosses the year boundary in both directions.
    await activity.getByRole('button', { name: 'Next month' }).click();
    await expect(monthName).toHaveText('November');
    await activity.getByRole('button', { name: 'Next month' }).click();
    await expect(monthName).toHaveText('December');
    await expect(yearJump).toContainText('2025');
    await activity.getByRole('button', { name: 'Next month' }).click();
    await expect(monthName).toHaveText('January');
    await expect(yearJump).toContainText('2026');
    await activity.getByRole('button', { name: 'Previous month' }).click();
    await expect(monthName).toHaveText('December');
    await expect(yearJump).toContainText('2025');

    const day = activity
      .locator('.profile-shell__month-day:not([disabled])')
      .first();
    await day.click();
    await expect(
      activity.locator('.profile-shell__month-detail')
    ).toBeVisible();

    await activity.screenshot({
      path: `${SCREENSHOT_DIR}/profile-activity-mobile.png`,
    });
  });

  for (const width of MOBILE_WIDTHS) {
    test(`mobile calendar fills card width at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openProfileActivity(page);

      const activity = page.getByRole('region', { name: 'Activity' });
      const monthHeatmap = activity.locator('.profile-shell__heatmap--month');
      const nav = monthHeatmap.locator('.profile-shell__month-nav');
      const chart = monthHeatmap.locator('.profile-shell__month-chart');
      const grid = monthHeatmap.locator('.profile-shell__month-grid');
      const weekdays = monthHeatmap.locator('.profile-shell__month-weekdays');
      const legend = monthHeatmap.locator('.profile-shell__month-legend');
      const monthName = monthHeatmap.locator('.profile-shell__month-nav-month');

      // Long month name stress case.
      await activity.getByRole('button', { name: 'Previous month' }).click();
      await activity.getByRole('button', { name: 'Previous month' }).click();
      await expect(monthName).toHaveText('September');

      const metrics = await page.evaluate(() => {
        const root = document.querySelector(
          '.profile-shell__heatmap--month'
        ) as HTMLElement | null;
        const navEl = root?.querySelector(
          '.profile-shell__month-nav'
        ) as HTMLElement | null;
        const chartEl = root?.querySelector(
          '.profile-shell__month-chart'
        ) as HTMLElement | null;
        const gridEl = root?.querySelector(
          '.profile-shell__month-grid'
        ) as HTMLElement | null;
        const weekdaysEl = root?.querySelector(
          '.profile-shell__month-weekdays'
        ) as HTMLElement | null;
        const legendEl = root?.querySelector(
          '.profile-shell__month-legend'
        ) as HTMLElement | null;
        const dayEl = root?.querySelector(
          '.profile-shell__month-day:not(.profile-shell__month-day--outside)'
        ) as HTMLElement | null;
        const monthEl = root?.querySelector(
          '.profile-shell__month-nav-month'
        ) as HTMLElement | null;
        const yearEl = root?.querySelector(
          '.profile-shell__month-year-trigger'
        ) as HTMLElement | null;

        if (
          !root ||
          !navEl ||
          !chartEl ||
          !gridEl ||
          !weekdaysEl ||
          !legendEl ||
          !dayEl ||
          !monthEl ||
          !yearEl
        ) {
          return null;
        }

        const rootBox = root.getBoundingClientRect();
        const navBox = navEl.getBoundingClientRect();
        const chartBox = chartEl.getBoundingClientRect();
        const gridBox = gridEl.getBoundingClientRect();
        const weekdaysBox = weekdaysEl.getBoundingClientRect();
        const legendBox = legendEl.getBoundingClientRect();
        const dayBox = dayEl.getBoundingClientRect();
        const monthBox = monthEl.getBoundingClientRect();
        const yearBox = yearEl.getBoundingClientRect();

        return {
          rootWidth: rootBox.width,
          navWidth: navBox.width,
          chartWidth: chartBox.width,
          gridWidth: gridBox.width,
          weekdaysWidth: weekdaysBox.width,
          legendWidth: legendBox.width,
          dayWidth: dayBox.width,
          dayHeight: dayBox.height,
          legendCentered:
            Math.abs(
              legendBox.left +
                legendBox.width / 2 -
                (gridBox.left + gridBox.width / 2)
            ) < 4,
          headerFits:
            monthBox.right <= yearBox.left + 1 &&
            yearBox.right <= navBox.right - 36 &&
            monthBox.left >= navBox.left + 36,
          noHorizontalClip: root.scrollWidth <= root.clientWidth + 1,
        };
      });

      expect(metrics).not.toBeNull();
      if (!metrics) {
        return;
      }

      await expect(nav).toBeVisible();
      await expect(chart).toBeVisible();
      await expect(grid).toBeVisible();
      await expect(weekdays).toBeVisible();
      await expect(legend).toBeVisible();

      expect(Math.abs(metrics.navWidth - metrics.chartWidth)).toBeLessThan(2);
      expect(Math.abs(metrics.chartWidth - metrics.gridWidth)).toBeLessThan(2);
      expect(Math.abs(metrics.weekdaysWidth - metrics.gridWidth)).toBeLessThan(
        2
      );
      expect(metrics.gridWidth / metrics.rootWidth).toBeGreaterThan(0.92);
      expect(metrics.dayWidth).toBeGreaterThanOrEqual(34);
      expect(metrics.dayHeight).toBeGreaterThanOrEqual(34);
      expect(Math.abs(metrics.dayWidth - metrics.dayHeight)).toBeLessThan(2);
      expect(metrics.legendCentered).toBe(true);
      expect(metrics.headerFits).toBe(true);
      expect(metrics.noHorizontalClip).toBe(true);

      await activity.screenshot({
        path: `${SCREENSHOT_DIR}/profile-activity-mobile-${width}.png`,
      });
    });
  }
});
