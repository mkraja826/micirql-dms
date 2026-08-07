import React, { useEffect, useMemo, useRef, useState } from 'react';
import './gallery-admin.css';
import { hydrateGalleryUrls, loadGalleryFiles, setGalleryFileArchived } from './gallery-admin-data';

const FILTERS = [
  ['all', 'All files'], ['xray', 'X-rays'], ['prescription', 'Prescriptions'],
  ['before_photo', 'Before photos'], ['after_photo', 'After photos'], ['report', 'Reports'], ['other', 'Other'],
];
const labelForType = (type) => ({ xray: 'X-ray', prescription: 'Prescription', before_photo: 'Before photo', after_photo: 'After photo', report: 'Report', other: 'Other' }[type] || 'Clinical file');
const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return 'Size not recorded';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const formatDate = (value, withTime = false) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value)) : 'Not recorded';
function isImage(file) {
  if (String(file.mime_type || '').startsWith('image/')) return true;
  const value = String(file.resolved_url || file.file_url || '').split('?')[0].toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'].some((extension) => value.endsWith(extension)) || ['xray', 'before_photo', 'after_photo'].includes(file.file_type);
}
function FilePreview({ file }) {
  if (!isImage(file)) return <div className="gallery-document-preview" aria-label={`${labelForType(file.file_type)} document`}><span>▤</span><strong>{labelForType(file.file_type)}</strong></div>;
  if (!file.resolved_url) return <div className="gallery-preview-pending" aria-label={`Preparing ${labelForType(file.file_type)} preview`}><span>◌</span><small>Preparing secure preview…</small></div>;
  return <img src={file.resolved_url} alt={`${labelForType(file.file_type)} for ${file.patient?.name || 'patient'}`} loading="lazy" decoding="async" />;
}

export default function GalleryAdmin({ profile, periodStart, periodEnd, periodLabel, onChanged }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewsLoading, setPreviewsLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('active');
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const loadVersion = useRef(0);

  async function load() {
    const version = ++loadVersion.current;
    setLoading(true); setError('');
    try {
      const rows = await loadGalleryFiles(profile, periodStart, periodEnd);
      if (version !== loadVersion.current) return;
      setFiles(rows);
      setSelected((current) => current ? rows.find((row) => row.id === current.id) || null : null);
      setLoading(false);
      setPreviewsLoading(true);
      const hydrated = await hydrateGalleryUrls(rows);
      if (version !== loadVersion.current) return;
      setFiles(hydrated);
      setSelected((current) => current ? hydrated.find((row) => row.id === current.id) || current : null);
    } catch (err) {
      if (version === loadVersion.current) setError(err?.message || 'Unable to load the clinic gallery.');
    } finally {
      if (version === loadVersion.current) { setLoading(false); setPreviewsLoading(false); }
    }
  }
  useEffect(() => { void load(); return () => { loadVersion.current += 1; }; }, [profile.clinic_id, periodStart, periodEnd]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return files.filter((file) => {
      const statusMatch = status === 'all' || (status === 'archived' ? file.archived_at : !file.archived_at);
      const typeMatch = type === 'all' || file.file_type === type;
      const searchable = [file.file_name, file.file_note, file.patient?.name, file.patient?.phone, file.patient?.patient_code, labelForType(file.file_type), file.uploader?.name].filter(Boolean).join(' ').toLowerCase();
      return statusMatch && typeMatch && (!term || searchable.includes(term));
    });
  }, [files, search, type, status]);

  const activeFiles = files.filter((file) => !file.archived_at);
  const storedBytes = activeFiles.reduce((sum, file) => sum + Number(file.stored_size_bytes || 0), 0);
  const metrics = [
    ['Active files', activeFiles.length], ['X-rays', activeFiles.filter((file) => file.file_type === 'xray').length],
    ['Prescriptions', activeFiles.filter((file) => file.file_type === 'prescription').length],
    ['Before / after', activeFiles.filter((file) => ['before_photo', 'after_photo'].includes(file.file_type)).length],
    ['Recorded storage', formatBytes(storedBytes)],
  ];

  async function archiveSelected() {
    if (!selected || reason.trim().length < 3) return;
    setBusy(true); setError('');
    try {
      await setGalleryFileArchived(selected.id, !selected.archived_at, reason.trim());
      setReason(''); await load(); await onChanged?.();
    } catch (err) { setError(err?.message || 'Unable to update this gallery file.'); }
    finally { setBusy(false); }
  }

  return <div className="gallery-admin">
    <section className="admin-section-title"><h2>Clinic gallery</h2><p>Files uploaded during <strong>{periodLabel || 'the selected period'}</strong>. Change Daily, Weekly or Monthly above to review another range.</p></section>
    {error ? <div className="admin-error" role="alert">{error}</div> : null}
    <section className="gallery-metrics">{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className="admin-panel gallery-controls">
      <label><span>Search gallery</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient, phone, file name, note..." /></label>
      <label><span>File type</span><select value={type} onChange={(event) => setType(event.target.value)}>{FILTERS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
      <button type="button" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
    </section>
    {previewsLoading && !loading ? <div className="gallery-preview-status" role="status">Files are ready. Secure image previews are loading in the background.</div> : null}
    {loading ? <div className="admin-empty">Loading gallery records…</div> : visible.length ? <section className="gallery-grid" aria-label="Clinic gallery files">{visible.map((file) => <button type="button" className={`gallery-card${file.archived_at ? ' archived' : ''}`} key={file.id} onClick={() => { setSelected(file); setReason(''); }}><div className="gallery-thumb"><FilePreview file={file} /><span className="gallery-type">{labelForType(file.file_type)}</span>{file.archived_at ? <span className="gallery-archived">Archived</span> : null}</div><div className="gallery-card-body"><strong>{file.patient?.name || 'Unknown patient'}</strong><span>{file.file_name || labelForType(file.file_type)}</span><small>{formatDate(file.created_at)} · {formatBytes(file.stored_size_bytes)}</small></div></button>)}</section> : <div className="admin-empty">No gallery files were uploaded during {periodLabel || 'this period'}.</div>}
    {selected ? <div className="gallery-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="gallery-modal" role="dialog" aria-modal="true" aria-labelledby="gallery-file-title"><header><div><small>{labelForType(selected.file_type)}</small><h3 id="gallery-file-title">{selected.file_name || selected.patient?.name || 'Clinical file'}</h3></div><button type="button" aria-label="Close gallery details" onClick={() => setSelected(null)}>×</button></header><div className="gallery-modal-layout"><div className="gallery-large-preview"><FilePreview file={selected} /></div><div className="gallery-details"><dl><div><dt>Patient</dt><dd>{selected.patient?.name || 'Unknown'}{selected.patient?.patient_code ? ` · ${selected.patient.patient_code}` : ''}</dd></div><div><dt>Phone</dt><dd>{selected.patient?.phone || 'Not recorded'}</dd></div><div><dt>Uploaded</dt><dd>{formatDate(selected.created_at, true)}</dd></div><div><dt>Uploaded by</dt><dd>{selected.uploader?.name || 'Not recorded'}</dd></div><div><dt>Visit</dt><dd>{selected.visit ? `${formatDate(selected.visit.visit_date)}${selected.visit.chief_complaint ? ` · ${selected.visit.chief_complaint}` : ''}` : 'Not linked to a visit'}</dd></div><div><dt>Size</dt><dd>{formatBytes(selected.stored_size_bytes)}</dd></div><div><dt>Notes</dt><dd>{selected.file_note || 'No note recorded'}</dd></div>{selected.archived_at ? <div><dt>Archived</dt><dd>{formatDate(selected.archived_at, true)} · {selected.archive_reason || 'No reason recorded'}</dd></div> : null}</dl><div className="gallery-modal-actions">{selected.resolved_url ? <a href={selected.resolved_url} target="_blank" rel="noreferrer">Open original</a> : <span>Preparing secure file link…</span>}</div><div className="gallery-archive-box"><strong>{selected.archived_at ? 'Restore this file' : 'Archive this file'}</strong><p>Archiving hides the file from the active gallery but preserves the clinical record and storage object.</p><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={selected.archived_at ? 'Reason for restoration' : 'Reason for archiving'} rows="3" /><button type="button" onClick={archiveSelected} disabled={busy || reason.trim().length < 3}>{busy ? 'Saving…' : selected.archived_at ? 'Restore file' : 'Archive file'}</button></div></div></div></section></div> : null}
  </div>;
}
