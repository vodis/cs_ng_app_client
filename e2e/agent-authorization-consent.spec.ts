import { expect, test, type Page } from '@playwright/test';
import { mockJsonApi, useAuthenticatedSession } from './utils/auth-fixtures';

const AUTH_ID = '00000000-0000-4000-8000-000000000001';
const SCREENSHOT_DIR = 'tmp/screenshots';

type ConsentFixture = {
  label: string;
  screenshot: string;
  body: Record<string, unknown>;
  expectVerifiedMark: boolean;
  expectWarning: boolean;
  expectLoopback: boolean;
  heading: string | RegExp;
};

const FIXTURES: ConsentFixture[] = [
  {
    label: 'verified metadata client',
    screenshot: `${SCREENSHOT_DIR}/agent-consent-verified.png`,
    heading: 'ChatGPT',
    expectVerifiedMark: true,
    expectWarning: false,
    expectLoopback: false,
    body: {
      id: AUTH_ID,
      clientName: 'ChatGPT',
      clientHost: 'chatgpt.com',
      clientUri: 'https://chatgpt.com',
      logoUri: null,
      redirectHost: 'chatgpt.com',
      clientVerification: 'metadata_document',
      loopbackRedirect: false,
      scopes: ['portfolio:read', 'offline_access'],
      expiresAt: '2030-01-01T00:00:00.000Z',
    },
  },
  {
    label: 'unverified device-flow client',
    screenshot: `${SCREENSHOT_DIR}/agent-consent-unverified.png`,
    heading: 'Local Codex',
    expectVerifiedMark: false,
    expectWarning: true,
    expectLoopback: false,
    body: {
      id: AUTH_ID,
      clientName: 'Local Codex',
      clientHost: null,
      clientUri: null,
      logoUri: null,
      redirectHost: null,
      clientVerification: 'unverified',
      loopbackRedirect: false,
      scopes: ['portfolio:read'],
      expiresAt: '2030-01-01T00:00:00.000Z',
    },
  },
  {
    label: 'loopback CLI client',
    screenshot: `${SCREENSHOT_DIR}/agent-consent-loopback.png`,
    heading: '127.0.0.1',
    expectVerifiedMark: false,
    expectWarning: true,
    expectLoopback: true,
    body: {
      id: AUTH_ID,
      clientName: '',
      clientHost: '127.0.0.1',
      clientUri: null,
      logoUri: null,
      redirectHost: '127.0.0.1:8787',
      clientVerification: 'unverified',
      loopbackRedirect: true,
      scopes: ['portfolio:read'],
      expiresAt: '2030-01-01T00:00:00.000Z',
    },
  },
];

async function mockConsentApis(
  page: Page,
  authorization: Record<string, unknown>
): Promise<void> {
  await mockJsonApi(
    page,
    `/api/v1/agent-authorizations/${AUTH_ID}`,
    authorization
  );
  await mockJsonApi(page, '/api/v1/agent-integrations/config', {
    enabled: true,
    mcpUrl: 'https://api.craftscript.com/mcp',
    testedClients: ['ChatGPT', 'Codex'],
    grantLifetimeDays: 30,
  });
}

async function openConsentPage(page: Page): Promise<void> {
  await page.goto(`/en/portfolio/agent/authorize?transaction=${AUTH_ID}`);
  await expect(page.locator('.authorization-card')).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('Agent consent identity', () => {
  for (const fixture of FIXTURES) {
    test(`renders ${fixture.label}`, async ({ page }) => {
      await useAuthenticatedSession(page);
      await mockConsentApis(page, fixture.body);
      await openConsentPage(page);

      await expect(
        page.getByRole('heading', { name: fixture.heading })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', {
          name: 'Allow this agent to view your portfolio?',
        })
      ).toBeVisible();

      if (fixture.expectVerifiedMark) {
        await expect(page.getByText(/verified as chatgpt\.com/i)).toBeVisible();
        await expect(
          page.getByText(/This client is not verified/i)
        ).toHaveCount(0);
      }

      if (fixture.expectWarning) {
        await expect(
          page.getByText(/This client is not verified/i)
        ).toBeVisible();
      }

      if (fixture.expectLoopback) {
        await expect(page.getByText(/runs on this computer/i)).toBeVisible();
        await expect(page.getByText('127.0.0.1:8787')).toBeVisible();
      }

      await page.screenshot({
        path: fixture.screenshot,
        fullPage: true,
      });
    });
  }

  test('legacy null identity fields do not crash', async ({ page }) => {
    await useAuthenticatedSession(page);
    await mockConsentApis(page, {
      id: AUTH_ID,
      clientName: 'Legacy agent',
      clientHost: null,
      clientUri: null,
      logoUri: null,
      redirectHost: null,
      clientVerification: null,
      loopbackRedirect: null,
      scopes: ['portfolio:read'],
      expiresAt: '2030-01-01T00:00:00.000Z',
    });
    await openConsentPage(page);

    await expect(
      page.getByRole('heading', { name: 'Legacy agent' })
    ).toBeVisible();
    await expect(page.getByText(/This client is not verified/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Allow access' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deny' })).toBeVisible();
  });
});

test.describe('Agent consent identity (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('verified card fits mobile viewport', async ({ page }) => {
    await useAuthenticatedSession(page);
    await mockConsentApis(page, FIXTURES[0]!.body);
    await openConsentPage(page);

    await expect(page.getByRole('heading', { name: 'ChatGPT' })).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/agent-consent-verified-mobile.png`,
      fullPage: true,
    });
  });
});
