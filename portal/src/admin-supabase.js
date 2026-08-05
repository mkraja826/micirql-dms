import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://mzjtdcpbvoximdukpukd.supabase.co';
const DEFAULT_KEY = 'sb_publishable_3krFoyWgVzrZP1g_pUy32g_iIn1AdYb';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_KEY,
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
);

const relation = (value) => Array.isArray(value) ? value[0] || null : value || null;
const requireResult = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data || [];
};

export function monthBounds(monthDate) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function signInAdmin(email, password) {
  const result = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (result.error) throw result.error;
  return result.data;
}

export async function loadAdminContext(userId) {
  const profileResult = await supabase
    .from('profiles')
    .select('id, clinic_id, name, email, role, active')
    .eq('id', userId)
    .maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const profile = profileResult.data;
  if (!profile?.active || !profile?.clinic_id) throw new Error('This account is not linked to an active clinic.');
  if (!['owner', 'head_doctor'].includes(profile.role)) {
    throw new Error('Clinic Admin is available only to the clinic owner or head doctor.');
  }

  const clinicResult = await supabase
    .from('clinics')
    .select('id, name, phone, email, address, currency_code, active')
    .eq('id', profile.clinic_id)
    .maybeSingle();
  if (clinicResult.error) throw clinicResult.error;
  if (!clinicResult.data?.active) throw new Error('This clinic is inactive.');
  return { profile, clinic: clinicResult.data };
}

export async function loadAdminMonth(profile, monthDate) {
  const clinicId = profile.clinic_id;
  const { start, end } = monthBounds(monthDate);
  const previousDate = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const previous = monthBounds(previousDate);

  const results = await Promise.all([
    supabase.from('patients').select('id, name, phone, age, gender, created_at').eq('clinic_id', clinicId).lte('created_at', end).order('created_at', { ascending: false }).limit(1000),
    supabase.from('appointments').select('id, appointment_time, status, patient_id, patients(name, phone)').eq('clinic_id', clinicId).gte('appointment_time', start).lte('appointment_time', end).order('appointment_time'),
    supabase.from('patient_visits').select('id, patient_id, doctor_id, visit_date, visit_status, patients(name), profiles!patient_visits_doctor_id_fkey(name)').eq('clinic_id', clinicId).gte('visit_date', start).lte('visit_date', end).order('visit_date'),
    supabase.from('treatments').select('id, patient_id, treatment_name, status, cost, created_at').eq('clinic_id', clinicId).gte('created_at', start).lte('created_at', end).order('created_at'),
    supabase.from('payments').select('id, patient_id, amount, payment_method, payment_category, notes, created_at, recorded_by, patients(name, phone), profiles!payments_recorded_by_fkey(name)').eq('clinic_id', clinicId).gte('created_at', start).lte('created_at', end).order('created_at'),
    supabase.from('invoices').select('id, patient_id, total_amount, paid_amount, due_amount, status, created_at, patients(name, phone)').eq('clinic_id', clinicId).lte('created_at', end).order('created_at'),
    supabase.from('profiles').select('id, name, email, role, active, created_at').eq('clinic_id', clinicId).order('name'),
    supabase.from('payments').select('id, amount, created_at').eq('clinic_id', clinicId).gte('created_at', previous.start).lte('created_at', previous.end),
    supabase.from('patient_visits').select('id, visit_date').eq('clinic_id', clinicId).gte('visit_date', previous.start).lte('visit_date', previous.end),
    supabase.from('patients').select('id, created_at').eq('clinic_id', clinicId).gte('created_at', previous.start).lte('created_at', previous.end),
  ]);

  const patients = requireResult(results[0], 'Unable to load patients');
  const appointments = requireResult(results[1], 'Unable to load appointments').map((row) => ({ ...row, patient: relation(row.patients) }));
  const visits = requireResult(results[2], 'Unable to load visits').map((row) => ({ ...row, patient: relation(row.patients), doctor: relation(row.profiles) }));
  const treatments = requireResult(results[3], 'Unable to load treatments');
  const payments = requireResult(results[4], 'Unable to load payments').map((row) => ({ ...row, patient: relation(row.patients), recorder: relation(row.profiles) }));
  const invoices = requireResult(results[5], 'Unable to load invoices').map((row) => ({ ...row, patient: relation(row.patients) }));
  const staff = requireResult(results[6], 'Unable to load staff');
  const previousPayments = requireResult(results[7], 'Unable to load previous payments');
  const previousVisits = requireResult(results[8], 'Unable to load previous visits');
  const previousPatients = requireResult(results[9], 'Unable to load previous patients');

  const monthPatients = patients.filter((row) => row.created_at >= start && row.created_at <= end);
  const billed = invoices.filter((row) => row.created_at >= start && row.created_at <= end).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const collected = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const outstanding = invoices.reduce((sum, row) => sum + Number(row.due_amount || 0), 0);
  const previousCollected = previousPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    period: { start, end, previousStart: previous.start, previousEnd: previous.end },
    patients,
    monthPatients,
    appointments,
    visits,
    treatments,
    payments,
    invoices,
    staff,
    metrics: {
      totalPatients: patients.length,
      newPatients: monthPatients.length,
      visits: visits.length,
      appointments: appointments.length,
      completed: appointments.filter((row) => ['completed', 'done'].includes(row.status)).length,
      cancelled: appointments.filter((row) => ['cancelled', 'canceled'].includes(row.status)).length,
      noShows: appointments.filter((row) => row.status === 'no_show').length,
      billed,
      collected,
      outstanding,
      collectionRate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
      averageVisitValue: visits.length ? Math.round(collected / visits.length) : 0,
      previousCollected,
      previousVisits: previousVisits.length,
      previousNewPatients: previousPatients.length,
    },
  };
}
