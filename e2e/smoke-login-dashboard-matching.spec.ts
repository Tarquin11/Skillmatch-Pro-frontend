import { expect, test } from '@playwright/test';

const apiBaseUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:8000';
const password = process.env.E2E_PASSWORD ?? 'SmokePass123!';

function buildUniqueEmail(): string {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return `smoke_front_${suffix}@example.com`;
}

test('login -> dashboard -> matching smoke flow', async ({ page, request }) => {
  let apiHealthy = false;
  try {
    const health = await request.get(`${apiBaseUrl}/`);
    apiHealthy = health.ok();
  } catch {
    apiHealthy = false;
  }

  test.skip(!apiHealthy, `Backend API not reachable at ${apiBaseUrl}`);

  const email = buildUniqueEmail();
  const signup = await request.post(`${apiBaseUrl}/auth/signup`, {
    data: {
      email,
      password,
      role: 'user',
    },
  });
  expect(signup.ok()).toBe(true);

  await page.goto('/login');
  await page.fill('input[formcontrolname="email"]', email);
  await page.fill('input[formcontrolname="password"]', password);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

  await page.click('a[href="/matching"]');
  await expect(page).toHaveURL(/\/matching$/);

  await page.fill('input[formcontrolname="job_title"]', 'Data Analyst');
  await page.fill('input[formcontrolname="required_skills"]', 'python, sql');
  await page.fill('input[formcontrolname="min_experience"]', '0');
  await page.fill('input[formcontrolname="limit"]', '10');
  await page.click('button[type="submit"]');

  const resultsTable = page.locator('table[aria-label="Matching results table"]');
  const emptyStateFr = page.locator('h3', { hasText: 'Aucun candidat trouve' });
  const emptyStateEn = page.locator('h3', { hasText: 'No candidates found' });

  await expect
    .poll(
      async () => {
        if (await resultsTable.isVisible()) return 'results';
        if (await emptyStateFr.isVisible()) return 'empty';
        if (await emptyStateEn.isVisible()) return 'empty';
        return 'pending';
      },
      { timeout: 15_000 },
    )
    .not.toBe('pending');
});
