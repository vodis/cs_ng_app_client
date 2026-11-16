import { expect, type Locator, type Page } from '@playwright/test';
import { useGuestSession } from '../utils/auth-fixtures';

export const SHELL_HEADER_HEIGHT_PX = 64;
export const SHELL_RAIL_WIDTH_PX = 72;
export const DESKTOP_GRID_COLUMNS = 7;
const SHELL_READY_TIMEOUT_MS = 30_000;

export function exchangeIntroHeading(page: Page): Locator {
  return page.getByRole('heading', { name: 'Token Exchange' });
}

export async function gotoExchangePage(page: Page): Promise<void> {
  await useGuestSession(page);
  await page.goto('/');

  // Desktop shell uses the slim rail (no top header); mobile still mounts app-header.
  await expect(page.locator('app-sidebar')).toBeVisible({
    timeout: SHELL_READY_TIMEOUT_MS,
  });
  await expect(exchangeIntroHeading(page)).toBeVisible({
    timeout: SHELL_READY_TIMEOUT_MS,
  });
}

export async function waitForStaticVerticalDivider(
  page: Page
): Promise<Locator> {
  const divider = page.locator('app-sidebar .sidebar__sweep');
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
