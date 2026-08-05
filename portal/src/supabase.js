import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://mzjtdcpbvoximdukpukd.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_3krFoyWgVzrZP1g_pUy32g_iIn1AdYb';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

function localDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function daysAgoStart(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function relation(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function requireResult(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result;
}

export async function signInToClinic(email, password) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured for the clinic portal.');
  }

  const result = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (result.error) throw result.error;
  return result.data;
}

export async function loadPortalContext(userId) {
  const profileResult = requireResult(
    await supabase
      .from('profiles')
      .select('id, clinic_id, name, email, role, active, phone')
      .eq('id', userId)
      .maybeSingle(),
    'Unable to load your CapDent profile'
  );

  const profile = profileResult.data;
  if (!profile) throw new Error('No CapDent clinic profile is linked to this account.');
  if (!profile.active) throw new Error('This clinic account is inactive. Contact the clinic owner.');
  if (!profile.clinic_id) throw new Error('This account is not linked to a clinic.');

  const clinicResult = requireResult(
    await supabase
      .from('clinics')
      .select('id, name, phone, email, address, currency_code, opening_time, closing_time, active')
      .eq('id', profile.clinic_id)
      .maybeSingle(),
    'Unable to load your clinic'
  );

  if (!clinicResult.data) throw new Error('The clinic linked to this account could not be found.');
  if (clinicResult.data.active === false) throw new Error('This clinic is currently inactive.');

  return { profile, clinic: clinicResult.data };
}

export async function loadPortalData(profile) {
  const clinicId = profile.clinic_id;
  const { start: todayStart, end: todayEnd } = localDayBounds();
  const sevenDayStart = daysAgoStart(6);

  const [
    patientCountResult,
    patientsResult,
    appointmentsResult,
    paymentsResult,
    dueInvoicesResult,
    visitsResult,
    visitsSeriesResult,
    filesResult,
    staffResult,
    treatmentsResult,
  ] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
    supabase
      .from('patients')
      .select('id, patient_code, name, phone, email, age, gender, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('appointments')
      .select('id, patient_id, appointment_time, status, notes, patients(name, phone), profiles!appointments_doctor_id_fkey(name)')
      .eq('clinic_id', clinicId)
      .gte('appointment_time', todayStart)
      .lte('appointment_time', todayEnd)
      .order('appointment_time', { ascending: true }),
    supabase
      .from('payments')
      .select('id, patient_id, amount, payment_method, payment_category, created_at, patients(name, phone)')
      .eq('clinic_id', clinicId)
      .gte('created_at', sevenDayStart)
      .lte('created_at', todayEnd)
      .order('created_at', { ascending: true }),
    supabase
      .from('invoices')
      .select('id, patient_id, total_amount, paid_amount, due_amount, status, created_at, patients(name, phone)')
      .eq('clinic_id', clinicId)
      .gt('due_amount', 0)
      .order('due_amount', { ascending: false })
      .limit(100),
    supabase
      .from('patient_visits')
      .select('id, patient_id, doctor_id, visit_date, chief_complaint, diagnosis, visit_status, patients(name), profiles!patient_visits_doctor_id_fkey(name)')
      .eq('clinic_id', clinicId)
      .order('visit_date', { ascending: false })
      .limit(50),
    supabase
      .from('patient_visits')
      .select('id, patient_id, visit_date')
      .eq('clinic_id', clinicId)
      .gte('visit_date', sevenDayStart)
      .lte('visit_date', todayEnd),
    supabase
      .from('files')
      .select('id, file_type, file_name, file_note, file_url, created_at, patients(name)')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('profiles')
      .select('id, name, email, role, active, created_at')
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true }),
    supabase
      .from('treatments')
      .select('id, treatment_name, status, cost, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(250),
  ]);

  requireResult(patientCountResult, 'Unable to count patients');
  requireResult(patientsResult, 'Unable to load patients');
  requireResult(appointmentsResult, 'Unable to load appointments');
  requireResult(paymentsResult, 'Unable to load payments');
  requireResult(dueInvoicesResult, 'Unable to load pending payments');
  requireResult(visitsResult, 'Unable to load visits');
  requireResult(visitsSeriesResult, 'Unable to load patient activity');
  requireResult(filesResult, 'Unable to load clinical files');
  requireResult(staffResult, 'Unable to load clinic staff');
  requireResult(treatmentsResult, 'Unable to load treatments');

  const patients = patientsResult.data || [];
  const appointments = (appointmentsResult.data || []).map((item) => ({
    ...item,
    patient: relation(item.patients),
    doctor: relation(item.profiles),
  }));
  const payments = (paymentsResult.data || []).map((item) => ({
    ...item,
    patient: relation(item.patients),
  }));
  const dueInvoices = (dueInvoicesResult.data || []).map((item) => ({
    ...item,
    patient: relation(item.patients),
  }));
  const recentVisits = (visitsResult.data || []).map((item) => ({
    ...item,
    patient: relation(item.patients),
    doctor: relation(item.profiles),
  }));
  const files = (filesResult.data || []).map((item) => ({
    ...item,
    patient: relation(item.patients),
  }));

  const todayPayments = payments.filter((item) => item.created_at >= todayStart && item.created_at <= todayEnd);
  const todayVisits = (visitsSeriesResult.data || []).filter(
    (item) => item.visit_date >= todayStart && item.visit_date <= todayEnd
  );
  const completedStatuses = new Set(['completed', 'done']);
  const waitingStatuses = new Set(['waiting', 'checked_in']);
  const scheduledStatuses = new Set(['scheduled', 'booked', 'reminded']);

  return {
    patientCount: patientCountResult.count || 0,
    patients,
    appointments,
    payments,
    todayPayments,
    dueInvoices,
    recentVisits,
    visitsSeries: visitsSeriesResult.data || [],
    files,
    staff: staffResult.data || [],
    treatments: treatmentsResult.data || [],
    metrics: {
      patientsToday: new Set(todayVisits.map((item) => item.patient_id)).size,
      newPatientsToday: patients.filter((item) => item.created_at >= todayStart && item.created_at <= todayEnd).length,
      waitingNow: appointments.filter((item) => waitingStatuses.has(item.status)).length,
      completedToday: appointments.filter((item) => completedStatuses.has(item.status)).length,
      bookedToday: appointments.filter((item) => scheduledStatuses.has(item.status)).length,
      missedToday: appointments.filter((item) => item.status === 'no_show').length,
      cancelledToday: appointments.filter((item) => ['cancelled', 'canceled'].includes(item.status)).length,
      followupsToday: appointments.filter((item) => item.status === 'followup').length,
      collectedToday: todayPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      pendingTotal: dueInvoices.reduce((sum, item) => sum + Number(item.due_amount || 0), 0),
    },
  };
}

export async function createPortalPatient(profile, values) {
  const payload = {
    clinic_id: profile.clinic_id,
    created_by: profile.id,
    name: values.name.trim(),
    phone: values.phone.trim() || null,
    age: values.age ? Number(values.age) : null,
    gender: values.gender || null,
  };

  const result = await supabase
    .from('patients')
    .insert(payload)
    .select('id, patient_code, name, phone, email, age, gender, created_at')
    .single();

  if (result.error) throw result.error;
  return result.data;
}

export async function updatePortalClinic(profile, values) {
  if (!['owner', 'head_doctor'].includes(profile.role)) {
    throw new Error('Only the clinic owner can update clinic details.');
  }

  const result = await supabase
    .from('clinics')
    .update({
      name: values.name.trim(),
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      address: values.address.trim() || null,
    })
    .eq('id', profile.clinic_id)
    .select('id, name, phone, email, address, currency_code, opening_time, closing_time, active')
    .single();

  if (result.error) throw result.error;
  return result.data;
}
