import { supabase } from './admin-supabase';

const relation = (value) => Array.isArray(value) ? value[0] || null : value || null;

function storageReference(row) {
  if (row.storage_bucket && row.storage_path) return { bucket: row.storage_bucket, path: row.storage_path };
  const value = String(row.file_url || '').trim();
  if (!value) return null;
  if (value.startsWith('supabase://')) {
    const objectReference = value.slice('supabase://'.length).split('?')[0];
    const separator = objectReference.indexOf('/');
    if (separator > 0) return { bucket: decodeURIComponent(objectReference.slice(0, separator)), path: decodeURIComponent(objectReference.slice(separator + 1)) };
  }
  for (const marker of ['/storage/v1/object/public/', '/storage/v1/object/sign/', '/storage/v1/object/authenticated/']) {
    const markerIndex = value.indexOf(marker);
    if (markerIndex === -1) continue;
    const objectReference = value.slice(markerIndex + marker.length).split('?')[0];
    const separator = objectReference.indexOf('/');
    if (separator > 0) return { bucket: decodeURIComponent(objectReference.slice(0, separator)), path: decodeURIComponent(objectReference.slice(separator + 1)) };
  }
  return null;
}

function prepareRows(rows) {
  return rows.map((row) => {
    const reference = storageReference(row);
    return {
      ...row,
      patient: relation(row.patients),
      uploader: relation(row.profiles),
      visit: relation(row.patient_visits),
      storage_reference: reference,
      resolved_url: reference ? null : row.file_url,
    };
  });
}

export async function hydrateGalleryUrls(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const reference = row.storage_reference || storageReference(row);
    if (!reference?.bucket || !reference?.path) return;
    const paths = groups.get(reference.bucket) || new Set();
    paths.add(reference.path);
    groups.set(reference.bucket, paths);
  });
  if (!groups.size) return rows;

  const signed = new Map();
  await Promise.all(Array.from(groups.entries()).map(async ([bucket, pathSet]) => {
    const result = await supabase.storage.from(bucket).createSignedUrls(Array.from(pathSet), 30 * 60);
    if (result.error) return;
    (result.data || []).forEach((item) => {
      if (item?.path && item?.signedUrl) signed.set(`${bucket}:${item.path}`, item.signedUrl);
    });
  }));

  return rows.map((row) => {
    const reference = row.storage_reference || storageReference(row);
    const secureUrl = reference ? signed.get(`${reference.bucket}:${reference.path}`) : null;
    return { ...row, resolved_url: secureUrl || row.resolved_url || (!reference ? row.file_url : null) };
  });
}

export async function loadGalleryFiles(profile, periodStart = null, periodEnd = null) {
  let query = supabase
    .from('files')
    .select(`
      id, clinic_id, patient_id, visit_id, file_type, file_url, file_name,
      file_note, xray_amount, xray_fee_status, storage_bucket, storage_path,
      mime_type, original_size_bytes, stored_size_bytes, uploaded_by, created_at,
      archived_at, archived_by, archive_reason,
      patients!files_patient_id_fkey(id, name, phone, patient_code),
      profiles!files_uploaded_by_fkey(id, name, role),
      patient_visits!files_visit_id_fkey(id, visit_date, chief_complaint)
    `)
    .eq('clinic_id', profile.clinic_id)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (periodStart) query = query.gte('created_at', periodStart);
  if (periodEnd) query = query.lte('created_at', periodEnd);
  const result = await query;
  if (result.error) throw result.error;
  return prepareRows(result.data || []);
}

export async function setGalleryFileArchived(fileId, archived, reason) {
  const result = await supabase.rpc('admin_set_file_archived', { p_file_id: fileId, p_archived: archived, p_reason: reason });
  if (result.error) throw result.error;
  return result.data;
}
