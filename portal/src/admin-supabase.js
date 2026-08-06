import { createClient } from '@supabase/supabase-js';
import { periodBounds } from './admin-period';

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
  const bounds = periodBounds('monthly', monthDate);
  return { start: bounds.start, end: bounds.end };
}

export async function signInAdmin(email, password) {
  const result = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (result.error) throw result.error;
  return result.data;
}

export async function loadAdminContext(userId) {
  const profileResult = await supabase.from('profiles').select('id, clinic_id, name, email, phone, role, active').eq('id', userId).maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const profile = profileResult.data;
  if (!profile?.active || !profile?.clinic_id) throw new Error('This account is not linked to an active clinic.');
  if (!['owner', 'head_doctor'].includes(profile.role)) throw new Error('Clinic Admin is available only to the clinic owner or head doctor.');
  const clinicResult = await supabase.from('clinics').select('id, name, phone, email, address, country_code, currency_code, active, brand_color, opening_time, closing_time, op_fee_amount, enable_patient_photos, enable_prescription_medications, payment_push_enabled, tooth_chart_enabled').eq('id', profile.clinic_id).maybeSingle();
  if (clinicResult.error) throw clinicResult.error;
  if (!clinicResult.data?.active) throw new Error('This clinic is inactive.');
  return { profile, clinic: clinicResult.data };
}

export async function loadPatientHistory(profile, patientId) {
  const [audits, visits, appointments, invoices, payments, treatments] = await Promise.all([
    supabase.from('patient_audit_logs').select('id, field_name, old_value, new_value, reason, created_at, changed_by, profiles!patient_audit_logs_changed_by_fkey(name)').eq('clinic_id', profile.clinic_id).eq('patient_id', patientId).order('created_at', { ascending: false }).limit(100),
    supabase.from('patient_visits').select('id, visit_date, chief_complaint, diagnosis, visit_status').eq('clinic_id', profile.clinic_id).eq('patient_id', patientId).order('visit_date', { ascending: false }).limit(50),
    supabase.from('appointments').select('id, appointment_time, status, notes').eq('clinic_id', profile.clinic_id).eq('patient_id', patientId).order('appointment_time', { ascending: false }).limit(50),
    supabase.from('invoices').select('id, total_amount, paid_amount, due_amount, status, created_at').eq('clinic_id', profile.clinic_id).eq('patient_id', patientId).order('created_at', { ascending: false }).limit(50),
    supabase.from('payments').select('id, amount, payment_method, payment_category, created_at').eq('clinic_id', profile.clinic_id).eq('patient_id', patientId).order('created_at', { ascending: false }).limit(50),
    supabase.from('treatments').select('id, treatment_name, status, cost, created_at').eq('clinic_id', profile.clinic_id).eq('patient_id', patientId).order('created_at', { ascending: false }).limit(50),
  ]);
  return {
    audits: requireResult(audits, 'Unable to load patient audit history').map((row) => ({ ...row, changedBy: relation(row.profiles) })),
    visits: requireResult(visits, 'Unable to load patient visits'),
    appointments: requireResult(appointments, 'Unable to load patient appointments'),
    invoices: requireResult(invoices, 'Unable to load patient invoices'),
    payments: requireResult(payments, 'Unable to load patient payments'),
    treatments: requireResult(treatments, 'Unable to load patient treatments'),
  };
}

export async function updateAdminPatient(patientId, values, reason) {
  const result = await supabase.rpc('admin_update_patient', {
    p_patient_id: patientId,
    p_name: values.name,
    p_phone: values.phone || null,
    p_email: values.email || null,
    p_age: values.age === '' ? null : Number(values.age),
    p_gender: values.gender || null,
    p_dob: values.dob || null,
    p_address: values.address || null,
    p_emergency_contact: values.emergency_contact || null,
    p_reason: reason,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function setAdminPatientArchived(patientId, archived, reason) {
  const result = await supabase.rpc('admin_set_patient_archived', { p_patient_id: patientId, p_archived: archived, p_reason: reason });
  if (result.error) throw result.error;
  return result.data;
}

export async function loadAdminPeriod(profile, anchorDate, mode = 'monthly') {
  const clinicId = profile.clinic_id;
  const period = periodBounds(mode, anchorDate);
  const { start, end, previousStart, previousEnd } = period;
  const results = await Promise.all([
    supabase.from('patients').select('id, patient_code, name, phone, email, age, gender, dob, address, emergency_contact, created_at, updated_at, archived_at, archive_reason').eq('clinic_id', clinicId).lte('created_at', end).order('created_at', { ascending: false }).limit(2000),
    supabase.from('appointments').select('id, appointment_time, status, patient_id, doctor_id, notes, patients(name, phone), profiles!appointments_doctor_id_fkey(name)').eq('clinic_id', clinicId).gte('appointment_time', start).lte('appointment_time', end).order('appointment_time'),
    supabase.from('patient_visits').select('id, patient_id, doctor_id, visit_date, visit_status, chief_complaint, diagnosis, doctor_notes, patients(name), profiles!patient_visits_doctor_id_fkey(name)').eq('clinic_id', clinicId).gte('visit_date', start).lte('visit_date', end).order('visit_date'),
    supabase.from('treatments').select('id, patient_id, treatment_name, status, cost, created_at').eq('clinic_id', clinicId).gte('created_at', start).lte('created_at', end).order('created_at'),
    supabase.from('payments').select('id, patient_id, amount, payment_method, payment_category, notes, status, created_at, collected_by, patients(name, phone), profiles!payments_collected_by_fkey(name)').eq('clinic_id', clinicId).gte('created_at', start).lte('created_at', end).order('created_at'),
    supabase.from('invoices').select('id, patient_id, total_amount, paid_amount, due_amount, status, created_at, patients(name, phone)').eq('clinic_id', clinicId).lte('created_at', end).order('created_at'),
    supabase.from('profiles').select('id, name, email, role, active, created_at').eq('clinic_id', clinicId).order('name'),
    supabase.from('payments').select('id, amount, created_at').eq('clinic_id', clinicId).gte('created_at', previousStart).lte('created_at', previousEnd),
    supabase.from('patient_visits').select('id, visit_date').eq('clinic_id', clinicId).gte('visit_date', previousStart).lte('visit_date', previousEnd),
    supabase.from('patients').select('id, created_at').eq('clinic_id', clinicId).gte('created_at', previousStart).lte('created_at', previousEnd),
    supabase.from('appointments').select('id, appointment_time').eq('clinic_id', clinicId).gte('appointment_time', previousStart).lte('appointment_time', previousEnd),
    supabase.from('files').select('id, file_type, created_at').eq('clinic_id', clinicId).gte('created_at', start).lte('created_at', end),
    supabase.from('files').select('id, created_at').eq('clinic_id', clinicId).gte('created_at', previousStart).lte('created_at', previousEnd),
  ]);

  const patients = requireResult(results[0], 'Unable to load patients');
  const appointments = requireResult(results[1], 'Unable to load appointments').map((row) => ({ ...row, patient: relation(row.patients), doctor: relation(row.profiles) }));
  const visits = requireResult(results[2], 'Unable to load visits').map((row) => ({ ...row, patient: relation(row.patients), doctor: relation(row.profiles), notes: row.doctor_notes }));
  const treatments = requireResult(results[3], 'Unable to load treatments');
  const payments = requireResult(results[4], 'Unable to load payments').map((row) => ({ ...row, patient: relation(row.patients), collector: relation(row.profiles) }));
  const allInvoices = requireResult(results[5], 'Unable to load invoices').map((row) => ({ ...row, patient: relation(row.patients) }));
  const staff = requireResult(results[6], 'Unable to load staff');
  const previousPayments = requireResult(results[7], 'Unable to load previous payments');
  const previousVisits = requireResult(results[8], 'Unable to load previous visits');
  const previousPatients = requireResult(results[9], 'Unable to load previous patients');
  const previousAppointments = requireResult(results[10], 'Unable to load previous appointments');
  const files = requireResult(results[11], 'Unable to load gallery activity');
  const previousFiles = requireResult(results[12], 'Unable to load previous gallery activity');

  const activePatients = patients.filter((row) => !row.archived_at);
  const periodPatients = activePatients.filter((row) => row.created_at >= start && row.created_at <= end);
  const invoices = allInvoices.filter((row) => row.created_at >= start && row.created_at <= end);
  const billed = invoices.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const collected = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const outstanding = allInvoices.reduce((sum, row) => sum + Number(row.due_amount || 0), 0);

  return {
    period,
    patients,
    periodPatients,
    monthPatients: periodPatients,
    appointments,
    visits,
    treatments,
    payments,
    invoices,
    allInvoices,
    files,
    staff,
    metrics: {
      totalPatients: activePatients.length,
      newPatients: periodPatients.length,
      visits: visits.length,
      appointments: appointments.length,
      galleryFiles: files.length,
      completed: appointments.filter((row) => ['completed', 'done'].includes(row.status)).length,
      cancelled: appointments.filter((row) => ['cancelled', 'canceled'].includes(row.status)).length,
      noShows: appointments.filter((row) => row.status === 'no_show').length,
      billed,
      collected,
      outstanding,
      collectionRate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
      averageVisitValue: visits.length ? Math.round(collected / visits.length) : 0,
      previousCollected: previousPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      previousVisits: previousVisits.length,
      previousNewPatients: previousPatients.length,
      previousAppointments: previousAppointments.length,
      previousGalleryFiles: previousFiles.length,
    },
  };
}

export async function loadAdminMonth(profile, monthDate) {
  return loadAdminPeriod(profile, monthDate, 'monthly');
}
