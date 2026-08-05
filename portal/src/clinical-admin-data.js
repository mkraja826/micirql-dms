import { supabase } from './admin-supabase';

const relation = (value) => Array.isArray(value) ? value[0] || null : value || null;
const rows = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data || [];
};

export async function loadClinicalMonth(profile, monthStart, monthEnd) {
  const [visitResult, doctorResult] = await Promise.all([
    supabase
      .from('patient_visits')
      .select('id, patient_id, doctor_id, visit_date, chief_complaint, diagnosis, doctor_notes, next_appointment_date, visit_status, created_at, updated_at, patients(id, patient_code, name, phone), profiles!patient_visits_doctor_id_fkey(id, name)')
      .eq('clinic_id', profile.clinic_id)
      .gte('visit_date', monthStart)
      .lte('visit_date', monthEnd)
      .order('visit_date', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, name, role, active')
      .eq('clinic_id', profile.clinic_id)
      .eq('active', true)
      .in('role', ['owner', 'head_doctor', 'doctor', 'working_doctor'])
      .order('name'),
  ]);

  const visits = rows(visitResult, 'Unable to load clinical visits').map((visit) => ({
    ...visit,
    patient: relation(visit.patients),
    doctor: relation(visit.profiles),
  }));
  const doctors = rows(doctorResult, 'Unable to load doctors');
  const visitIds = visits.map((visit) => visit.id);

  if (!visitIds.length) return { visits, doctors, treatments: [], chartEntries: [] };

  const [treatmentResult, chartResult] = await Promise.all([
    supabase
      .from('treatments')
      .select('id, visit_id, patient_id, treatment_name, description, category, cost, status, created_at, updated_at')
      .eq('clinic_id', profile.clinic_id)
      .in('visit_id', visitIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('dental_chart_entries')
      .select('id, visit_id, patient_id, recorded_by, tooth_code, dentition, condition, surfaces, notes, treatment_name, treatment_status, created_at')
      .eq('clinic_id', profile.clinic_id)
      .in('visit_id', visitIds)
      .order('created_at', { ascending: false }),
  ]);

  return {
    visits,
    doctors,
    treatments: rows(treatmentResult, 'Unable to load treatments'),
    chartEntries: rows(chartResult, 'Unable to load dental chart entries'),
  };
}

export async function loadClinicalVisitDetails(profile, visitId) {
  const [treatmentResult, chartResult, auditResult] = await Promise.all([
    supabase
      .from('treatments')
      .select('id, visit_id, patient_id, treatment_name, description, category, cost, status, created_at, updated_at')
      .eq('clinic_id', profile.clinic_id)
      .eq('visit_id', visitId)
      .order('created_at', { ascending: false }),
    supabase
      .from('dental_chart_entries')
      .select('id, visit_id, patient_id, recorded_by, tooth_code, dentition, condition, surfaces, notes, treatment_name, treatment_status, created_at')
      .eq('clinic_id', profile.clinic_id)
      .eq('visit_id', visitId)
      .order('created_at', { ascending: false }),
    supabase
      .from('clinical_audit_logs')
      .select('id, target_type, target_id, action, field_name, old_value, new_value, reason, created_at, changed_by, profiles!clinical_audit_logs_changed_by_fkey(name)')
      .eq('clinic_id', profile.clinic_id)
      .eq('visit_id', visitId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  return {
    treatments: rows(treatmentResult, 'Unable to load visit treatments'),
    chartEntries: rows(chartResult, 'Unable to load dental chart history'),
    audits: rows(auditResult, 'Unable to load clinical audit history').map((audit) => ({
      ...audit,
      changedBy: relation(audit.profiles),
    })),
  };
}

export async function updateClinicalVisit(visitId, values, reason) {
  const result = await supabase.rpc('admin_update_clinical_visit', {
    p_visit_id: visitId,
    p_doctor_id: values.doctor_id || null,
    p_visit_date: new Date(values.visit_date).toISOString(),
    p_chief_complaint: values.chief_complaint || null,
    p_diagnosis: values.diagnosis || null,
    p_doctor_notes: values.doctor_notes || null,
    p_next_appointment_date: values.next_appointment_date ? new Date(values.next_appointment_date).toISOString() : null,
    p_reason: reason,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function updateClinicalTreatment(treatmentId, values, reason) {
  const result = await supabase.rpc('admin_update_clinical_treatment', {
    p_treatment_id: treatmentId,
    p_treatment_name: values.treatment_name,
    p_description: values.description || null,
    p_category: values.category || null,
    p_status: values.status,
    p_reason: reason,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function addDentalChartCorrection(visitId, values, reason) {
  const result = await supabase.rpc('admin_add_dental_chart_correction', {
    p_visit_id: visitId,
    p_tooth_code: values.tooth_code,
    p_dentition: values.dentition,
    p_condition: values.condition,
    p_surfaces: values.surfaces,
    p_notes: values.notes || null,
    p_treatment_name: values.treatment_name || null,
    p_treatment_status: values.treatment_status,
    p_reason: reason,
  });
  if (result.error) throw result.error;
  return result.data;
}
