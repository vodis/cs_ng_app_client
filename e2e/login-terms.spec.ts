import { expect, test } from '@playwright/test';
import {
  CURRENT_TERMS_VERSION,
  TERMS_ACCEPTANCE_STORAGE_KEY,
} from '../src/app/core/auth/terms-acceptance.constants';
import {
  useAuthenticatedSession,
  useGuestSession,
} from './utils/auth-fixtures';

test.describe('Login Terms acceptance', () => {
  test('gates protected routes until Terms are accepted', async ({ page }) => {
    await useAuthenticatedSession(page, {
      user: {
        id: 'terms-user',
        providerUserId: 'terms-provider-user',
        sessionId: 'terms-session',
        email: 'terms@craftscript.test',
        authMethod: 'email',
        passkeyEnabled: false,
      },
      wallets: [
        {
          id: 'terms-wallet',
          providerWalletId: 'terms-provider-wallet',
          address: '0x00000000000000000000000000000000000000aa',
          chainType: 'evm',
          walletType: 'embedded',
          source: 'e2e',
          status: 'active',
          isPrimary: true,
          deletedAt: null,
        },
      ],
      accessToken: 'terms-access-token',
      termsAcceptance: 'none',
    });

    await page.goto('/en/profile');
    await expect(page).toHaveURL(/\/en\/terms/);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      'Terms and Conditions'
    );

    const termsBody = page.locator('.terms-shell__body');
    await expect(termsBody).toBeVisible();
    await termsBody.evaluate(el => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    const agree = page.getByRole('button', { name: 'I agree' });
    await expect(agree).toBeEnabled();
    await agree.click();

    await expect(page).toHaveURL(/\/en\/profile/);
    await expect
      .poll(async () =>
        page.evaluate(
          ({ storageKey, userId }) => {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) {
              return null;
            }
            const store = JSON.parse(raw) as Record<
              string,
              { version: string }
            >;
            return store[userId]?.version ?? null;
          },
          {
            storageKey: TERMS_ACCEPTANCE_STORAGE_KEY,
            userId: 'terms-user',
          }
        )
      )
      .toBe(CURRENT_TERMS_VERSION);
  });

  test('shows the changed title when a prior Terms version exists', async ({
    page,
  }) => {
    await useAuthenticatedSession(page, {
      user: {
        id: 'terms-update-user',
        providerUserId: 'terms-update-provider',
        sessionId: 'terms-update-session',
        email: 'terms-update@craftscript.test',
        authMethod: 'email',
      },
      wallets: [],
      accessToken: 'terms-update-token',
      termsAcceptance: 'stale',
    });

    await page.goto('/en/portfolio');
    await expect(page).toHaveURL(/\/en\/terms/);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      'Our Terms of Service have changed'
    );
  });

  test('does not force guests onto Terms', async ({ page }) => {
    await useGuestSession(page);
    await page.goto('/en');
    await expect(page).not.toHaveURL(/\/terms/);
  });
});
