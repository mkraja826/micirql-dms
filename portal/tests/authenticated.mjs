import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:4173/portal/';
const now = new Date();
const USER_ID = '79a71e71-d8c9-4c2e-8e84-e147424126da';
const CLINIC_ID = 'dd3a4818-f890-40ac-b4c7-568699bc9755';
const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const DOCTOR_ID = USER_ID;
const APPOINTMENT_ID = '22222222-2222-4222-8222-222222222222';
const VISIT_ID = '33333333-3333-4333-8333-333333333333';
const INVOICE_ID = '44444444-4444-4444-8444-444444444444';
const PAYMENT_ID = '55555555-5555-4555-8555-555555555555';
const monthDate = new Date(now.getFullYear(), now.getMonth(), 5, 10, 30).toISOString();

const authUser = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner-test@ospuuq.invalid',
  email_confirmed_at: now.toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const profile = { id: USER_ID, clinic_id: CLINIC_ID, name: 'Test Head Doctor', email: authUser.email, phone: '9000000000', role: 'head_doctor', active: true, created_at: now.toISOString() };
const clinic = { id: CLINIC_ID, name: 'ospuuq', phone: '9000000001', email: 'clinic@ospuuq.invalid', address: 'Test clinic', currency_code: 'INR', active: true, brand_color: '#087f72', opening_time: '09:00:00', closing_time: '20:00:00', op_fee_amount: 300, enable_patient_photos: true, enable_prescription_medications: true, payment_push_enabled: true, tooth_chart_enabled: true };
const patient = { id: PATIENT_ID, clinic_id: CLINIC_ID, patient_code: 'TEST-001', name: 'Demo Patient', phone: '9000000002', email: 'patient@example.invalid', age: 31, gender: 'Other', dob: '1995-01-01', address: 'Demo address', emergency_contact: '9000000003', created_at: monthDate, updated_at: monthDate, archived_at: null, archive_reason: null };
const appointment = { id: APPOINTMENT_ID, clinic_id: CLINIC_ID, patient_id: PATIENT_ID, doctor_id: DOCTOR_ID, appointment_time: monthDate, status: 'scheduled', notes: 'Mock appointment', created_at: monthDate, updated_at: monthDate, patients: { name: patient.name, phone: patient.phone }, profiles: { name: profile.name } };
const visit = { id: VISIT_ID, clinic_id: CLINIC_ID, patient_id: PATIENT_ID, doctor_id: DOCTOR_ID, visit_date: monthDate, visit_status: 'completed', chief_complaint: 'Routine check', diagnosis: 'Healthy', doctor_notes: 'Mock visit', next_appointment_date: null, patients: { name: patient.name, phone: patient.phone }, profiles: { name: profile.name } };
const treatment = { id: '66666666-6666-4666-8666-666666666666', clinic_id: CLINIC_ID, patient_id: PATIENT_ID, visit_id: VISIT_ID, treatment_name: 'Consultation', description: 'Mock treatment', category: 'General', status: 'completed', cost: 500, created_at: monthDate, patients: { name: patient.name }, patient_visits: { visit_date: monthDate } };
const payment = { id: PAYMENT_ID, clinic_id: CLINIC_ID, patient_id: PATIENT_ID, invoice_id: INVOICE_ID, amount: 500, payment_method: 'upi', payment_category: 'treatment', notes: 'Mock payment', created_at: monthDate, paid_at: monthDate, collected_by: USER_ID, status: 'active', patients: { name: patient.name, phone: patient.phone }, profiles: { name: profile.name }, invoices: { total_amount: 500, paid_amount: 500, due_amount: 0, status: 'paid' } };
const invoice = { id: INVOICE_ID, clinic_id: CLINIC_ID, patient_id: PATIENT_ID, total_amount: 500, paid_amount: 500, due_amount: 0, status: 'paid', created_at: monthDate, updated_at: monthDate, patients: { name: patient.name, phone: patient.phone } };

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Content-Range': '0-0/1' } });
}

function tableResponse(resource, url) {
  if (resource === 'profiles') return url.searchParams.has('id') ? profile : [profile];
  if (resource === 'clinics') return clinic;
  if (resource === 'patients') return [patient];
  if (resource === 'appointments') return [appointment];
  if (resource === 'patient_visits') return [visit];
  if (resource === 'treatments') return [treatment];
  if (resource === 'payments') return [payment];
  if (resource === 'invoices') return [invoice];
  if (resource === 'dental_chart_entries') return [];
  if (resource.endsWith('_audit_logs')) return [];
  if (resource === 'financial_adjustments' || resource === 'invoice_versions') return [];
  if (resource === 'patient_files' || resource === 'device_push_tokens' || resource === 'staff_invites') return [];
  return [];
}

function rpcResponse(name) {
  if (name === 'admin_get_management_overview') {
    return {
      staff: [{ ...profile, activity: { patients: 1, appointments: 1, visits: 1, payments: 500, files: 0, modifications: 0 } }],
      pending_invites: [],
      storage: { total_files: 0, stored_bytes: 0, original_bytes: 0, missing_size_files: 0, by_type: [] },
      subscription: { plan_name: 'Free', status: 'active', visit_limit: 300 },
      devices: { active: 0, inactive: 0, errors: 0 },
      audit: [],
    };
  }
  if (name === 'admin_get_unified_audit' || name === 'admin_get_archived_records') return [];
  if (name === 'admin_get_release_health') return { client_errors_24h: 0, client_errors_7d: 0, paid_total_mismatches: 0, due_total_mismatches: 0 };
  if (name === 'record_admin_client_error') return null;
  return [];
}

async function assertNoSeriousAccessibilityIssues(page, label) {
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
  if (blocking.length) {
    throw new Error(`${label} accessibility blockers: ${blocking.map((item) => `${item.id}(${item.nodes.length})`).join(', ')}`);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.route('**/auth/v1/token?grant_type=password', (route) => json(route, {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user: authUser,
  }));
  await page.route('**/auth/v1/user', (route) => json(route, authUser));
  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url());
    const resource = url.pathname.split('/rest/v1/')[1] || '';
    if (resource.startsWith('rpc/')) return json(route, rpcResponse(resource.slice(4)));
    return json(route, tableResponse(resource, url));
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await assertNoSeriousAccessibilityIssues(page, 'Sign-in screen');

  await page.keyboard.press('Tab');
  const focusedText = await page.evaluate(() => document.activeElement?.textContent?.trim());
  if (focusedText !== 'Skip to Clinic Admin content') throw new Error(`Skip link was not first in keyboard order: ${focusedText}`);

  await page.getByLabel('Account email').fill(authUser.email);
  await page.getByLabel('Password').fill('mock-password');
  await page.getByRole('button', { name: 'Sign in as owner / head doctor' }).click();
  await page.getByRole('heading', { name: 'Clinic performance', level: 1 }).waitFor({ state: 'visible' });
  await assertNoSeriousAccessibilityIssues(page, 'Authenticated dashboard');

  const sections = ['Patients', 'Appointments', 'Visits & treatments', 'Payments & invoices', 'Doctors & staff', 'Reports & exports', 'Audit & archived', 'Clinic settings'];
  for (const section of sections) {
    await page.locator('.admin-nav button').filter({ hasText: section }).click();
    await page.getByRole('heading', { name: section, level: 1, exact: true }).waitFor({ state: 'visible' });
    if (await page.getByText('Admin access needs attention').count()) throw new Error(`${section} entered the global error screen.`);
  }

  if (pageErrors.length) throw new Error(`Authenticated page errors: ${pageErrors.join(' | ')}`);
  console.log('Clinic Admin authenticated navigation and accessibility test passed.');
} finally {
  await context.close();
  await browser.close();
}
