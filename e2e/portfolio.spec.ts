import { expect, test } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

test.describe('Portfolio and agent access', () => {
  test.beforeEach(async ({ page }) => {
    await useAuthenticatedSession(page);
    await mockJsonApi(page, '/api/v1/investment-profile', {
      objective: 'growth',
      riskTolerance: 'balanced',
      horizon: '3_5y',
      updatedAt: '2026-08-19T12:00:00Z',
    });
    await mockJsonApi(page, '/api/v1/agent-integrations/config', {
      enabled: true,
      mcpUrl: 'https://api.craftscript.com/mcp',
      testedClients: ['ChatGPT', 'Codex'],
      grantLifetimeDays: 30,
    });
    await mockJsonApi(page, '/api/v1/agent-connections', {
      connections: [],
    });
  });

  test('shows agent context, sessions, and a provider-neutral connection flow', async ({
    page,
  }) => {
    await page.goto('/en/portfolio');

    await expect(
      page.getByRole('heading', { name: 'Agents & security' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Investment preferences' })
    ).toBeVisible();
    await expect(page.getByText('Agent context')).toBeVisible();

    const preferencesCard = page.locator('.preferences-card');
    await expect(preferencesCard.getByText('Objective', { exact: true })).toBeVisible();
    await expect(preferencesCard.getByText('Growth', { exact: true })).toBeVisible();
    await expect(preferencesCard.getByText('Risk', { exact: true })).toBeVisible();
    await expect(preferencesCard.getByText('Balanced', { exact: true })).toBeVisible();
    await expect(preferencesCard.getByText('Horizon', { exact: true })).toBeVisible();
    await expect(preferencesCard.getByText('3–5 years')).toBeVisible();
    await expect(
      preferencesCard.getByRole('button', { name: 'Edit' })
    ).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await expect(page.getByText('$1,250.50')).toHaveCount(0);
    await expect(page.getByText('250.1 NEAR')).toHaveCount(0);
    await expect(page.getByText('e2e@craftscript.test')).toHaveCount(0);

    await page.getByRole('button', { name: 'Connect AI agent' }).click();
    await expect(
      page.getByRole('heading', { name: 'Connect an AI agent' })
    ).toBeVisible();
    await expect(
      page.getByText('https://api.craftscript.com/mcp')
    ).toBeVisible();
    await expect(
      page.getByText(/CraftScript receives no OpenAI/i)
    ).toBeVisible();
  });

  test('section nav scrolls within /en/portfolio instead of jumping to /#…', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en/portfolio');

    await expect(
      page.getByRole('navigation', { name: 'Portfolio sections' })
    ).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Portfolio sections' })
      .getByRole('link', { name: 'Security' })
      .click();

    await expect(page).toHaveURL(/\/en\/portfolio(?:\?[^#]*)?#portfolio-security$/);
    await expect(page.locator('#portfolio-security')).toBeInViewport();
    await expect(page).not.toHaveURL(/\/#portfolio-security/);
  });
});
