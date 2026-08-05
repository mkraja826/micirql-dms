import { supabase } from './admin-supabase';

const relation = (value) => Array.isArray(value) ? value[0] || null : value || null;
const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data || [];
};

export async function loadFinancialAdmin(profile, monthStart, monthEnd) {
  const clinicId = profile.clinic_id;
  const [invoicesResult, paymentsResult, adjustmentsResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, clinic_id, patient_id, visit_id, original_total_amount, total_amount, paid_amount, due_amount, discount_amount, waived_amount, refunded_amount, version_number, status, invoice_type, payment_category, notes, created_at, updated_at, patients(id, patient_code, name, phone)')
      .eq('clinic_id', clinicId)
      .lte('created_at', monthEnd)
      .order('created_at', { ascending: false })
      .limit(1500),
    supabase
      .from('payments')
      .select('id, invoice_id, patient_id, amount, payment_method, payment_category, notes, status, original_payment_id, created_at, updated_at, collected_by, patients(id, patient_code, name, phone), profiles!payments_collected_by_fkey(name)')
      .eq('clinic_id', clinicId)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .order('created_at', { ascending: false })
      .limit(1500),
    supabase
      .from('financial_adjustments')
      .select('id, patient_id, invoice_id, payment_id, related_payment_id, adjustment_type, amount, reason, notes, created_at, created_by, patients(name, phone), profiles!financial_adjustments_created_by_fkey(name)')
      .eq('clinic_id', clinicId)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  const invoices = requireData(invoicesResult, 'Unable to load invoices').map((row) => ({ ...row, patient: relation(row.patients) }));
  const payments = requireData(paymentsResult, 'Unable to load payments').map((row) => ({ ...row, patient: relation(row.patients), collector: relation(row.profiles) }));
  const adjustments = requireData(adjustmentsResult, 'Unable to load financial adjustments').map((row) => ({ ...row, patient: relation(row.patients), changedBy: relation(row.profiles) }));
  return { invoices, payments, adjustments };
}

export async function loadInvoiceFinancialHistory(profile, invoiceId) {
  const clinicId = profile.clinic_id;
  const [paymentsResult, adjustmentsResult, versionsResult] = await Promise.all([
    supabase
      .from('payments')
      .select('id, invoice_id, patient_id, amount, payment_method, payment_category, notes, status, original_payment_id, created_at, updated_at, collected_by, profiles!payments_collected_by_fkey(name)')
      .eq('clinic_id', clinicId)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false }),
    supabase
      .from('financial_adjustments')
      .select('id, payment_id, related_payment_id, adjustment_type, amount, old_values, new_values, reason, notes, created_at, created_by, profiles!financial_adjustments_created_by_fkey(name)')
      .eq('clinic_id', clinicId)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoice_versions')
      .select('id, version_number, change_type, adjustment_id, snapshot, reason, created_at, created_by, profiles!invoice_versions_created_by_fkey(name)')
      .eq('clinic_id', clinicId)
      .eq('invoice_id', invoiceId)
      .order('version_number', { ascending: false }),
  ]);

  return {
    payments: requireData(paymentsResult, 'Unable to load invoice payments').map((row) => ({ ...row, collector: relation(row.profiles) })),
    adjustments: requireData(adjustmentsResult, 'Unable to load invoice adjustments').map((row) => ({ ...row, changedBy: relation(row.profiles) })),
    versions: requireData(versionsResult, 'Unable to load invoice versions').map((row) => ({ ...row, changedBy: relation(row.profiles) })),
  };
}

export async function correctPayment(paymentId, values) {
  const result = await supabase.rpc('admin_correct_payment', {
    p_payment_id: paymentId,
    p_amount: Number(values.amount),
    p_payment_method: values.payment_method,
    p_payment_category: values.payment_category,
    p_notes: values.notes || null,
    p_paid_at: values.paid_at ? new Date(values.paid_at).toISOString() : null,
    p_reason: values.reason,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function voidPayment(paymentId, values) {
  const result = await supabase.rpc('admin_void_payment', {
    p_payment_id: paymentId,
    p_reason: values.reason,
    p_notes: values.notes || null,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function refundPayment(paymentId, values) {
  const result = await supabase.rpc('admin_refund_payment', {
    p_payment_id: paymentId,
    p_amount: Number(values.amount),
    p_refund_method: values.payment_method,
    p_notes: values.notes || null,
    p_reason: values.reason,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function discountInvoice(invoiceId, values) {
  const result = await supabase.rpc('admin_apply_invoice_discount', {
    p_invoice_id: invoiceId,
    p_amount: Number(values.amount),
    p_reason: values.reason,
    p_notes: values.notes || null,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function waiveInvoice(invoiceId, values) {
  const result = await supabase.rpc('admin_waive_invoice_due', {
    p_invoice_id: invoiceId,
    p_amount: Number(values.amount),
    p_reason: values.reason,
    p_notes: values.notes || null,
  });
  if (result.error) throw result.error;
  return result.data;
}
