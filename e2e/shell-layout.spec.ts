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

  test('sidebar draws interior lines then reveals the menu', async ({
    page,
  }) => {
    await expect(page.locator('app-sidebar .sidebar__line')).toHaveCount(4);
    await expect(page.locator('app-sidebar .sidebar__nav')).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByRole('link', { name: 'Portfolio' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Trade' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Transactions' })
    ).toBeVisible();
    await expect(
      page.locator('app-sidebar').getByText('Informations')
    ).toHaveCount(0);
    await expect(page.locator('app-sidebar').getByText('Finance')).toHaveCount(
      0
    );
    await expect(page.locator('app-sidebar').getByText('Activity')).toHaveCount(
      0
    );
    await page.getByRole('link', { name: 'Portfolio' }).click();
    await expect(page).toHaveURL(/\/portfolio/);
    await expect(page.locator('app-sidebar .sidebar__nav')).toBeVisible({
      timeout: 3000,
    });
  });

  test('sidebar fills the viewport below the header and stays put while content scrolls', async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    const sidebar = page.locator('app-sidebar');
    const router = page.locator('.main-layout__content_router');
    const before = await readBox(sidebar);
    const expectedHeight = viewport!.height - SHELL_HEADER_HEIGHT_PX;

    expect(before.height).toBeGreaterThanOrEqual(expectedHeight - 2);
    expect(before.height).toBeLessThanOrEqual(expectedHeight + 2);

    await router.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });

    const after = await readBox(sidebar);
    expect(after.y).toBe(before.y);
    expect(after.height).toBe(before.height);
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

  test('connect wallet control is not visible in header', async ({ page }) => {
    await expect(
      page
        .locator('app-header')
        .getByRole('button', { name: /connect wallet/i })
    ).toHaveCount(0);
  });
});

test.describe('Mobile floating navigation', () => {
  test.use({ viewport: { width: 390, height: 360 } });

  test.beforeEach(async ({ page }) => {
    await gotoExchangePage(page);
  });

  test('More panel stays scrollable on short landscape viewports', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'More' }).click();

    const viewport = page.locator('.floating-nav__viewport');
    await expect(viewport).toBeVisible();

    const overflowY = await viewport.evaluate(
      el => getComputedStyle(el).overflowY
    );
    expect(overflowY).toBe('auto');

    await expect(page.getByRole('link', { name: 'Docs' })).toBeAttached();

    await page.getByRole('link', { name: 'Docs' }).evaluate(el => {
      (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    });
    await expect(page.getByRole('link', { name: 'Docs' })).toBeVisible();
  });

  test('inactive level is removed from keyboard tab order', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Open navigation' }).click();

    const moreLevel = page.locator('.floating-nav__level--more');
    await expect(moreLevel).toHaveAttribute('inert', '');

    await page.getByRole('button', { name: 'More' }).click();

    await expect(page.locator('.floating-nav__level--primary')).toHaveAttribute(
      'inert',
      ''
    );
    await expect(moreLevel).not.toHaveAttribute('inert');
  });
});
