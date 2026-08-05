import { supabase } from './admin-supabase';

const one = (value) => Array.isArray(value) ? value[0] || null : value || null;
const required = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data || [];
};

export async function loadAppointmentAdmin(profile, start, end) {
  const [appointmentsResult, patientsResult, doctorsResult] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, patient_id, doctor_id, appointment_time, status, notes, reminder_status, created_at, updated_at, patients(name, phone, archived_at), profiles!appointments_doctor_id_fkey(name)')
      .eq('clinic_id', profile.clinic_id)
      .gte('appointment_time', start)
      .lte('appointment_time', end)
      .order('appointment_time', { ascending: true }),
    supabase
      .from('patients')
      .select('id, patient_code, name, phone, archived_at')
      .eq('clinic_id', profile.clinic_id)
      .is('archived_at', null)
      .order('name', { ascending: true })
      .limit(1000),
    supabase
      .from('profiles')
      .select('id, name, role, active')
      .eq('clinic_id', profile.clinic_id)
      .eq('active', true)
      .in('role', ['owner', 'head_doctor', 'doctor', 'working_doctor'])
      .order('name', { ascending: true }),
  ]);

  return {
    appointments: required(appointmentsResult, 'Unable to load appointments').map((row) => ({
      ...row,
      patient: one(row.patients),
      doctor: one(row.profiles),
    })),
    patients: required(patientsResult, 'Unable to load active patients'),
    doctors: required(doctorsResult, 'Unable to load clinic doctors'),
  };
}

export async function loadAppointmentAudit(profile, appointmentId) {
  const result = await supabase
    .from('appointment_audit_logs')
    .select('id, action, field_name, old_value, new_value, reason, created_at, changed_by, profiles!appointment_audit_logs_changed_by_fkey(name)')
    .eq('clinic_id', profile.clinic_id)
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: false })
    .limit(100);
  return required(result, 'Unable to load appointment audit history').map((row) => ({
    ...row,
    changedBy: one(row.profiles),
  }));
}

export async function createAdminAppointment(values) {
  const result = await supabase.rpc('admin_create_appointment', {
    p_patient_id: values.patient_id,
    p_doctor_id: values.doctor_id || null,
    p_appointment_time: new Date(values.appointment_time).toISOString(),
    p_notes: values.notes || null,
    p_reason: values.reason,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function updateAdminAppointment(appointmentId, values) {
  const result = await supabase.rpc('admin_update_appointment', {
    p_appointment_id: appointmentId,
    p_patient_id: values.patient_id,
    p_doctor_id: values.doctor_id || null,
    p_appointment_time: new Date(values.appointment_time).toISOString(),
    p_status: values.status,
    p_notes: values.notes || null,
    p_reason: values.reason,
  });
  if (result.error) throw result.error;
  return result.data;
}
