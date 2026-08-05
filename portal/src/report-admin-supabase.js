import { supabase } from './supabase';

function throwIfError(error) {
  if (error) throw error;
}

export async function loadUnifiedAudit({ start = null, end = null, source = null, search = null, limit = 200, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('admin_get_unified_audit', {
    p_start: start,
    p_end: end,
    p_source: source || null,
    p_search: search || null,
    p_limit: limit,
    p_offset: offset,
  });
  throwIfError(error);
  return data || [];
}

export async function loadArchivedRecords() {
  const { data, error } = await supabase.rpc('admin_get_archived_records');
  throwIfError(error);
  return data || [];
}

export async function recordReportExport({ reportType, format, periodStart = null, periodEnd = null, rowCount = 0 }) {
  const { data, error } = await supabase.rpc('admin_record_report_export', {
    p_report_type: reportType,
    p_export_format: format,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_row_count: Math.max(0, Number(rowCount || 0)),
  });
  throwIfError(error);
  return data;
}

export async function restoreArchivedPatient(patientId, reason) {
  const { data, error } = await supabase.rpc('admin_set_patient_archived', {
    p_patient_id: patientId,
    p_archived: false,
    p_reason: reason,
  });
  throwIfError(error);
  return data;
}
