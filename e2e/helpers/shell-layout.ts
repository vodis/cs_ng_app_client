import { expect, type Locator, type Page } from '@playwright/test';

export const SHELL_HEADER_HEIGHT_PX = 64;
export const DESKTOP_GRID_COLUMNS = 7;

export async function gotoExchangePage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.exchange-page .intro h1')).toHaveText(
    'Token Exchange'
  );
}

export async function waitForStaticVerticalDivider(
  page: Page
): Promise<Locator> {
  const divider = page.locator('.main-layout__divider');
  await expect(divider).toBeVisible({ timeout: 10_000 });
  return divider;
}

export async function readBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

export async function readGridRowStart(locator: Locator): Promise<string> {
  return locator.evaluate(el => getComputedStyle(el).gridRowStart);
}
