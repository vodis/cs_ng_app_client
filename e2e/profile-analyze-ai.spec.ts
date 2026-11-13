import { expect, test, type Page } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

async function openAuthenticatedProfile(page: Page): Promise<void> {
  await useAuthenticatedSession(page, {
    user: {
      id: 'analyze-user',
      providerUserId: 'analyze-provider',
      sessionId: 'analyze-session',
      email: 'analyze@craftscript.test',
    },
    wallets: [
      {
        id: 'analyze-wallet',
        providerWalletId: 'analyze-provider-wallet',
        address: '0x00000000000000000000000000000000000000aa',
        chainType: 'evm',
        walletType: 'embedded',
        source: 'e2e',
        status: 'active',
        isPrimary: true,
        deletedAt: null,
      },
    ],
    accessToken: 'analyze-access-token',
  });

  await mockJsonApi(page, '/api/v1/assets', { data: [] });
  await mockJsonApi(page, '/api/v1/portfolio', {
    totalValue: '0',
    positions: [],
    unpricedPositionCount: 0,
  });
  await mockJsonApi(page, '/api/v1/balances', {
    data: [],
    meta: { partial: false },
  });
  await mockJsonApi(page, '/api/v1/investment-profile', {
    objective: 'growth',
    riskTolerance: 'balanced',
    horizon: '3_5y',
    updatedAt: '2026-08-19T12:00:00Z',
  });
  await mockJsonApi(page, '/api/v1/agent-integrations/config', {
    enabled: true,
    mcpUrl: 'https://api.craftscript.com/mcp',
    testedClients: ['ChatGPT'],
    grantLifetimeDays: 30,
  });
  await mockJsonApi(page, '/api/v1/agent-connections', { connections: [] });

  await page.goto('/en/profile');
  await expect(page.locator('.profile-shell')).toBeVisible();
}

test.describe('Profile Analyze AI placement', () => {
  test('shows one Analyze AI control below 768px and opens portfolio', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 767, height: 844 });
    await openAuthenticatedProfile(page);

    const analyzeAi = page.getByRole('button', { name: 'Analyze AI' });
    await expect(analyzeAi).toHaveCount(1);
    await expect(page.locator('.profile-shell__analyze-ai')).toBeVisible();
    await expect(page.locator('.profile-shell__fund-action--ai')).toBeHidden();

    await analyzeAi.click();
    await expect(page).toHaveURL(/\/en\/portfolio/);
  });

  test('shows one Analyze AI control at desktop width and opens portfolio', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await openAuthenticatedProfile(page);

    const analyzeAi = page.getByRole('button', { name: 'Analyze AI' });
    await expect(analyzeAi).toHaveCount(1);
    await expect(page.locator('.profile-shell__fund-action--ai')).toBeVisible();
    await expect(page.locator('.profile-shell__analyze-ai')).toBeHidden();

    await analyzeAi.click();
    await expect(page).toHaveURL(/\/en\/portfolio/);
  });
});
