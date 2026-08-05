import { supabase } from './admin-supabase';

function throwIfError(error) {
  if (error) throw error;
}

export async function loadManagementOverview(monthStart) {
  const date = monthStart ? String(monthStart).slice(0, 10) : new Date().toISOString().slice(0, 7) + '-01';
  const { data, error } = await supabase.rpc('admin_get_management_overview', { p_month_start: date });
  throwIfError(error);
  return data || { staff: [], pending_invites: [], storage: {}, subscription: {}, devices: {}, audit: [] };
}

export async function createStaffInvite(values) {
  const { data, error } = await supabase.rpc('admin_create_staff_invite', {
    p_name: values.name,
    p_email: values.email || null,
    p_role: values.role,
    p_reason: values.reason,
  });
  throwIfError(error);
  return data;
}

export async function cancelStaffInvite(inviteId, reason) {
  const { data, error } = await supabase.rpc('admin_cancel_staff_invite', {
    p_invite_id: inviteId,
    p_reason: reason,
  });
  throwIfError(error);
  return data;
}

export async function updateStaffMember(values) {
  const { data, error } = await supabase.rpc('admin_update_staff_member', {
    p_staff_id: values.id,
    p_name: values.name,
    p_phone: values.phone || null,
    p_role: values.role,
    p_active: values.active,
    p_reason: values.reason,
  });
  throwIfError(error);
  return data;
}

export async function updateClinicSettings(values) {
  const { data, error } = await supabase.rpc('admin_update_clinic_settings', {
    p_name: values.name,
    p_phone: values.phone || null,
    p_email: values.email || null,
    p_address: values.address || null,
    p_brand_color: values.brand_color,
    p_opening_time: values.opening_time,
    p_closing_time: values.closing_time,
    p_op_fee_amount: Number(values.op_fee_amount || 0),
    p_enable_patient_photos: Boolean(values.enable_patient_photos),
    p_enable_prescription_medications: Boolean(values.enable_prescription_medications),
    p_payment_push_enabled: Boolean(values.payment_push_enabled),
    p_tooth_chart_enabled: Boolean(values.tooth_chart_enabled),
    p_reason: values.reason,
  });
  throwIfError(error);
  return data;
}
