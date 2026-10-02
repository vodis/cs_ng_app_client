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
      page.getByRole('heading', { name: 'Your portfolio' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Investment preferences' })
    ).toBeVisible();
    await expect(page.getByText('Agent context')).toBeVisible();
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
});
