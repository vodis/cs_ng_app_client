import { expect, test } from '@playwright/test';
import {
  exchangeIntroHeading,
  gotoExchangePage,
  readBox,
  readGridRowStart,
  SHELL_HEADER_HEIGHT_PX,
  SHELL_RAIL_WIDTH_PX,
  waitForStaticVerticalDivider,
} from './helpers/shell-layout';

test.describe('Shell layout (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoExchangePage(page);
  });

  test('stays on Token Exchange without redirecting guests to login', async ({
    page,
  }) => {
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(exchangeIntroHeading(page)).toBeVisible();
  });

  test('desktop shell uses the slim rail without a top header', async ({
    page,
  }) => {
    await expect(page.locator('app-header')).toHaveCount(0);
    await expect(page.locator('app-sidebar')).toBeVisible();
  });

  test('main content starts at the top beside the rail', async ({ page }) => {
    const rail = await readBox(page.locator('app-sidebar'));
    const router = await readBox(page.locator('.main-layout__content_router'));

    expect(router.y).toBeGreaterThanOrEqual(rail.y - 1);
    expect(router.y).toBeLessThanOrEqual(rail.y + 1);
  });

  test('exchange intro sits near top of content area', async ({ page }) => {
    const router = await readBox(page.locator('.main-layout__content_router'));
    const intro = await readBox(page.locator('.exchange-page .intro'));

    const gap = intro.y - router.y;
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(24);
  });

  test('rail edge line stays visible after load animation', async ({
    page,
  }) => {
    const divider = await waitForStaticVerticalDivider(page);
    const dividerBox = await readBox(divider);

    expect(dividerBox.height).toBeGreaterThan(200);
    expect(dividerBox.width).toBeGreaterThanOrEqual(1);
  });

  test('sidebar and router share grid row 1', async ({ page }) => {
    await waitForStaticVerticalDivider(page);

    const routerRow = await readGridRowStart(
      page.locator('.main-layout__content_router')
    );
    const sidebarRow = await readGridRowStart(page.locator('app-sidebar'));

    expect(routerRow).toBe('1');
    expect(sidebarRow).toBe('1');
  });

  test('slim rail keeps accessible nav links in the DOM', async ({ page }) => {
    await expect(page.locator('app-sidebar .sidebar__nav')).toBeVisible({
      timeout: 3000,
    });
    await expect(
      page.locator('app-sidebar').getByRole('link', { name: 'Profile' })
    ).toBeVisible();
    await expect(
      page.locator('app-sidebar').getByRole('link', { name: 'Trade' })
    ).toBeVisible();
    await expect(
      page.locator('app-sidebar').getByRole('link', { name: 'Transactions' })
    ).toBeVisible();
    await expect(
      page.locator('app-sidebar').getByRole('link', { name: 'Portfolio' })
    ).toBeVisible();
    await expect(
      page.locator('app-sidebar').getByRole('button', { name: 'Wallets' })
    ).toBeVisible();

    await page.goto('/en/farm');
    await expect(page).toHaveURL(/\/farm/);
    await expect(page.locator('app-sidebar .sidebar__nav')).toBeVisible({
      timeout: 3000,
    });
  });

  test('rail fills the viewport height and stays put while content scrolls', async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    const sidebar = page.locator('app-sidebar');
    const router = page.locator('.main-layout__content_router');
    const before = await readBox(sidebar);

    expect(before.height).toBeGreaterThanOrEqual(viewport!.height - 2);
    expect(before.height).toBeLessThanOrEqual(viewport!.height + 2);

    await router.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });

    const after = await readBox(sidebar);
    expect(after.y).toBe(before.y);
    expect(after.height).toBe(before.height);
  });

  test('rail width stays near 64–72px', async ({ page }) => {
    const sidebar = await readBox(page.locator('app-sidebar'));

    expect(sidebar.width).toBeGreaterThanOrEqual(64 - 2);
    expect(sidebar.width).toBeLessThanOrEqual(SHELL_RAIL_WIDTH_PX + 2);
  });

  test('vertical rail edge aligns with sidebar right edge', async ({
    page,
  }) => {
    const divider = await waitForStaticVerticalDivider(page);
    const sidebar = await readBox(page.locator('app-sidebar'));
    const dividerBox = await readBox(divider);

    expect(dividerBox.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width - 4);
    expect(dividerBox.x).toBeLessThanOrEqual(sidebar.x + sidebar.width + 2);
  });
});

test.describe('Mobile shell header', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await gotoExchangePage(page);
  });

  test('header height matches design system (64px)', async ({ page }) => {
    const header = await readBox(page.locator('app-header'));

    expect(header.height).toBeGreaterThanOrEqual(SHELL_HEADER_HEIGHT_PX - 1);
    expect(header.height).toBeLessThanOrEqual(SHELL_HEADER_HEIGHT_PX + 1);
  });
});

test.describe('Mobile slide-in navigation', () => {
  test.use({ viewport: { width: 390, height: 360 } });

  test.beforeEach(async ({ page }) => {
    await gotoExchangePage(page);
  });

  test('slide-in panel stays scrollable on short landscape viewports', async ({
    page,
  }) => {
    const menuButton = page.locator('app-header .header__menu-button');
    await expect(menuButton).toBeVisible();
    await expect(page.locator('.floating-trigger')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0);

    await menuButton.click();

    const viewport = page.locator('.slide-nav__viewport');
    await expect(viewport).toBeVisible();

    const overflowY = await viewport.evaluate(
      el => getComputedStyle(el).overflowY
    );
    expect(overflowY).toBe('auto');

    const panel = page.locator('#floatingNav');
    await expect(panel.getByRole('link', { name: 'Docs' })).toBeAttached();

    await panel.getByRole('link', { name: 'Docs' }).evaluate(el => {
      (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    });
    await expect(panel.getByRole('link', { name: 'Docs' })).toBeVisible();
    // exact: 'EN' is a substring of other button names (e.g. "Swap tokens").
    await expect(
      panel.getByRole('button', { name: 'EN', exact: true })
    ).toBeVisible();
    await expect(
      panel.getByRole('button', { name: 'Logout', exact: true })
    ).toHaveCount(0);
    await expect(panel.getByRole('heading', { name: 'Menu' })).toBeVisible();
    await expect(
      panel.locator('.slide-nav__close button.cs-close-button')
    ).toBeVisible();
    await expect(page.locator('.nav-overlay')).toHaveCount(0);
  });

  test('restores focus to the header menu trigger on Escape', async ({
    page,
  }) => {
    const menuButton = page.locator('app-header .header__menu-button');
    await menuButton.click();
    await expect(page.locator('#floatingNav')).toBeVisible();
    await expect(page.locator('.side-modal.open')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('.side-modal.open')).toHaveCount(0);
    await expect(menuButton).toBeFocused();
  });

  test('closes from the shared cs-ui close button and restores focus', async ({
    page,
  }) => {
    const menuButton = page.locator('app-header .header__menu-button');
    await menuButton.click();
    await expect(page.locator('.side-modal.open')).toBeVisible();

    await page
      .locator('#floatingNav .slide-nav__close button.cs-close-button')
      .click();

    await expect(page.locator('.side-modal.open')).toHaveCount(0);
    await expect(menuButton).toBeFocused();
  });
});
