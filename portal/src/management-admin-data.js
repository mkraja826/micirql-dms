import { supabase } from './admin-supabase';

function throwIfError(error) { if (error) throw error; }
const rows = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data || []; };

export async function loadManagementOverview(periodStart, periodEnd) {
  const start = periodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const end = periodEnd || new Date().toISOString();
  const monthDate = new Date(start);
  const monthStart = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const results = await Promise.all([
    supabase.rpc('admin_get_management_overview', { p_month_start: monthStart }),
    supabase.from('patients').select('created_by').gte('created_at', start).lte('created_at', end),
    supabase.from('appointments').select('created_by').gte('created_at', start).lte('created_at', end),
    supabase.from('patient_visits').select('created_by').gte('created_at', start).lte('created_at', end),
    supabase.from('payments').select('collected_by').gte('created_at', start).lte('created_at', end),
    supabase.from('files').select('uploaded_by').gte('created_at', start).lte('created_at', end),
    supabase.rpc('admin_get_unified_audit', { p_start: start, p_end: end, p_source: null, p_search: null, p_limit: 1000, p_offset: 0 }),
  ]);
  throwIfError(results[0].error);
  const overview = results[0].data || { staff: [], pending_invites: [], storage: {}, subscription: {}, devices: {}, audit: [] };
  const activity = new Map();
  const get = (id) => {
    if (!id) return null;
    if (!activity.has(id)) activity.set(id, { patients_created: 0, appointments_created: 0, visits_created: 0, payments_recorded: 0, files_uploaded: 0, records_modified: 0 });
    return activity.get(id);
  };
  rows(results[1], 'Unable to load staff patient activity').forEach((item) => { const value = get(item.created_by); if (value) value.patients_created += 1; });
  rows(results[2], 'Unable to load staff appointment activity').forEach((item) => { const value = get(item.created_by); if (value) value.appointments_created += 1; });
  rows(results[3], 'Unable to load staff visit activity').forEach((item) => { const value = get(item.created_by); if (value) value.visits_created += 1; });
  rows(results[4], 'Unable to load staff payment activity').forEach((item) => { const value = get(item.collected_by); if (value) value.payments_recorded += 1; });
  rows(results[5], 'Unable to load staff upload activity').forEach((item) => { const value = get(item.uploaded_by); if (value) value.files_uploaded += 1; });
  rows(results[6], 'Unable to load staff modification activity').forEach((item) => { const value = get(item.actor_id); if (value) value.records_modified += 1; });
  return {
    ...overview,
    staff: (overview.staff || []).map((staff) => ({ ...staff, activity: activity.get(staff.id) || { patients_created: 0, appointments_created: 0, visits_created: 0, payments_recorded: 0, files_uploaded: 0, records_modified: 0 } })),
    selected_period: { start, end },
  };
}

export async function createStaffInvite(values) {
  const { data, error } = await supabase.rpc('admin_create_staff_invite', { p_name: values.name, p_email: values.email || null, p_role: values.role, p_reason: values.reason });
  throwIfError(error); return data;
}
export async function cancelStaffInvite(inviteId, reason) {
  const { data, error } = await supabase.rpc('admin_cancel_staff_invite', { p_invite_id: inviteId, p_reason: reason });
  throwIfError(error); return data;
}
export async function updateStaffMember(values) {
  const { data, error } = await supabase.rpc('admin_update_staff_member', { p_staff_id: values.id, p_name: values.name, p_phone: values.phone || null, p_role: values.role, p_active: values.active, p_reason: values.reason });
  throwIfError(error); return data;
}
export async function updateClinicSettings(values) {
  const { data, error } = await supabase.rpc('admin_update_clinic_settings', {
    p_name: values.name, p_phone: values.phone || null, p_email: values.email || null, p_address: values.address || null,
    p_brand_color: values.brand_color, p_opening_time: values.opening_time, p_closing_time: values.closing_time,
    p_op_fee_amount: Number(values.op_fee_amount || 0), p_enable_patient_photos: Boolean(values.enable_patient_photos),
    p_enable_prescription_medications: Boolean(values.enable_prescription_medications), p_payment_push_enabled: Boolean(values.payment_push_enabled),
    p_tooth_chart_enabled: Boolean(values.tooth_chart_enabled), p_reason: values.reason,
  });
  throwIfError(error); return data;
}