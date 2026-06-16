import { expect, test } from '@playwright/test';
import {
  DESKTOP_GRID_COLUMNS,
  gotoExchangePage,
  readBox,
  readGridRowStart,
  SHELL_HEADER_HEIGHT_PX,
  waitForStaticVerticalDivider,
} from './helpers/shell-layout';

test.describe('Shell layout (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoExchangePage(page);
  });

  test('header height matches design system (64px)', async ({ page }) => {
    const header = await readBox(page.locator('app-header'));

    expect(header.height).toBeGreaterThanOrEqual(SHELL_HEADER_HEIGHT_PX - 1);
    expect(header.height).toBeLessThanOrEqual(SHELL_HEADER_HEIGHT_PX + 1);
  });

  test('main content starts directly below header', async ({ page }) => {
    const header = await readBox(page.locator('app-header'));
    const router = await readBox(page.locator('.main-layout__content_router'));

    expect(router.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    expect(router.y).toBeLessThanOrEqual(header.y + header.height + 1);
  });

  test('exchange intro sits near top of content area', async ({ page }) => {
    const router = await readBox(page.locator('.main-layout__content_router'));
    const intro = await readBox(page.locator('.exchange-page .intro'));

    const gap = intro.y - router.y;
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(24);
  });

  test('vertical divider stays visible after load animation', async ({
    page,
  }) => {
    await expect(
      page.locator('.main-layout__content app-animate-line')
    ).toHaveCount(0);

    const divider = await waitForStaticVerticalDivider(page);
    const dividerBox = await readBox(divider);

    expect(dividerBox.height).toBeGreaterThan(200);
    expect(dividerBox.width).toBeGreaterThanOrEqual(1);
  });

  test('sidebar, divider, and router share grid row 1', async ({ page }) => {
    await waitForStaticVerticalDivider(page);

    const routerRow = await readGridRowStart(
      page.locator('.main-layout__content_router')
    );
    const dividerRow = await readGridRowStart(
      page.locator('.main-layout__divider')
    );

    expect(routerRow).toBe('1');
    expect(dividerRow).toBe('1');
  });

  test('sidebar width matches first column of 7-column grid', async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    const sidebar = await readBox(page.locator('app-sidebar'));
    const expectedColumnWidth = viewport!.width / DESKTOP_GRID_COLUMNS;

    expect(sidebar.width).toBeGreaterThanOrEqual(expectedColumnWidth - 2);
    expect(sidebar.width).toBeLessThanOrEqual(expectedColumnWidth + 2);
  });

  test('vertical divider aligns with sidebar right edge', async ({ page }) => {
    const divider = await waitForStaticVerticalDivider(page);
    const sidebar = await readBox(page.locator('app-sidebar'));
    const dividerBox = await readBox(divider);

    expect(dividerBox.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width - 2);
    expect(dividerBox.x).toBeLessThanOrEqual(sidebar.x + sidebar.width + 2);
  });

  test('connect wallet control is visible in header', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /connect wallet/i }).first()
    ).toBeVisible();
  });
});
