import { chromium } from 'playwright';

const baseUrl = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:4173/portal/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
        message: 'Invalid login credentials',
      }),
    });
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const title = await page.title();
  if (!title.includes('CapDent Clinic Portal')) {
    throw new Error(`Unexpected page title: ${title}`);
  }

  const email = page.locator('#clinic-email');
  const password = page.locator('#clinic-password');
  const submit = page.getByRole('button', { name: 'Sign in to clinic' });

  await email.waitFor({ state: 'visible' });
  await password.waitFor({ state: 'visible' });
  await submit.waitFor({ state: 'visible' });

  await submit.click();
  await page.getByRole('alert').filter({
    hasText: 'Enter the email and password connected to your CapDent account.',
  }).waitFor({ state: 'visible' });

  await email.fill('invalid@example.com');
  await password.fill('incorrect-password');
  await submit.click();
  await page.getByRole('alert').filter({ hasText: 'Incorrect email or password.' }).waitFor({ state: 'visible' });

  const dashboardHeading = page.getByRole('heading', { name: 'Clinic dashboard' });
  if (await dashboardHeading.count()) {
    throw new Error('Unauthenticated smoke test unexpectedly reached the clinic dashboard.');
  }

  console.log('Clinic Portal browser smoke test passed.');
} finally {
  await browser.close();
}
