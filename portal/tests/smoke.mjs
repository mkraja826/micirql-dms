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
  if (!title.includes('CapDent Clinic Admin')) {
    throw new Error(`Unexpected page title: ${title}`);
  }

  const email = page.getByLabel('Account email');
  const password = page.getByLabel('Password');
  const submit = page.getByRole('button', { name: 'Sign in as owner / head doctor' });

  await email.waitFor({ state: 'visible' });
  await password.waitFor({ state: 'visible' });
  await submit.waitFor({ state: 'visible' });

  await submit.click();
  await page.getByText('Enter your CapDent account email and password.').waitFor({ state: 'visible' });

  await email.fill('invalid@example.com');
  await password.fill('incorrect-password');
  await submit.click();
  await page.getByText('Incorrect email or password.').waitFor({ state: 'visible' });

  if (await page.getByRole('heading', { name: 'Clinic performance' }).count()) {
    throw new Error('Unauthenticated smoke test unexpectedly reached Clinic Admin.');
  }

  console.log('Clinic Admin browser smoke test passed.');
} finally {
  await browser.close();
}
