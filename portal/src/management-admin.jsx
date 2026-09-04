import React, { useEffect, useMemo, useState } from 'react';
import './management-admin.css';
import {
  cancelStaffInvite,
  createStaffInvite,
  loadManagementOverview,
  updateClinicSettings,
  updateStaffMember,
} from './management-admin-data';

const EMPTY = { staff: [], pending_invites: [], storage: {}, subscription: {}, devices: {}, audit: [] };
const roleLabel = (role = '') => role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const sizeLabel = (bytes) => {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
};
const monthValue = (value) => value ? String(value).slice(0, 7) : new Date().toISOString().slice(0, 7);
const activityTotal = (activity = {}) => Object.values(activity).reduce((sum, value) => sum + Number(value || 0), 0);

function Notice({ type = 'success', children }) {
  return <div className={`management-notice ${type}`}>{children}</div>;
}

function StaffEditor({ staff, actor, onClose, onSaved }) {
  const [form, setForm] = useState({
    id: staff.id,
    name: staff.name || '',
    phone: staff.phone || '',
    role: staff.role,
    active: Boolean(staff.active),
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canAssignHeadDoctor = actor.role === 'owner';

  async function submit(event) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      await updateStaffMember(form);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to update this staff member.');
    } finally { setSaving(false); }
  }

  return <div className="management-overlay" role="dialog" aria-modal="true">
    <form className="management-drawer" onSubmit={submit}>
      <div className="management-drawer-head"><div><h2>Edit staff member</h2><p>Email access remains controlled by Supabase Auth.</p></div><button type="button" onClick={onClose}>×</button></div>
      <div className="management-form-grid">
        <label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label>Email<input value={staff.email || ''} disabled /></label>
        <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          {canAssignHeadDoctor || form.role === 'head_doctor' ? <option value="head_doctor">Head doctor</option> : null}
          <option value="working_doctor">Working doctor</option>
          <option value="receptionist">Receptionist</option>
        </select></label>
      </div>
      <label className="management-toggle"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span><strong>Clinic access active</strong><small>Turning this off also disables active push tokens for this staff account.</small></span></label>
      <label>Modification reason<textarea rows="3" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Example: Doctor moved to another branch" required /></label>
      {error ? <Notice type="error">{error}</Notice> : null}
      <div className="management-drawer-actions"><button type="button" onClick={onClose}>Cancel</button><button className="admin-primary" disabled={saving}>{saving ? 'Saving…' : 'Save audited changes'}</button></div>
    </form>
  </div>;
}

function InviteForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'working_doctor', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const invite = await createStaffInvite(form);
      setCreated(invite);
    } catch (err) { setError(err?.message || 'Unable to create invitation.'); }
    finally { setSaving(false); }
  }

  async function closeAfterCreate() {
    if (created) {
      setSaving(true); setError('');
      try { await onSaved(); }
      catch (err) { setError(err?.message || 'Invitation was created, but the team list could not be refreshed.'); setSaving(false); return; }
      setSaving(false);
    }
    onClose();
  }

  async function copyCode() {
    if (!created?.invite_code) return;
    try { await navigator.clipboard.writeText(created.invite_code); } catch { /* Browser may block clipboard. */ }
  }

  return <div className="management-overlay" role="dialog" aria-modal="true"><div className="management-drawer">
    <div className="management-drawer-head"><div><h2>Invite clinic staff</h2><p>The staff member signs up and accepts this clinic code.</p></div><button type="button" onClick={closeAfterCreate} disabled={saving}>×</button></div>
    {created ? <div className="management-invite-created"><span>Invite code</span><strong>{created.invite_code}</strong><p>Assigned to {created.email || 'any authenticated email'} as {roleLabel(created.role)}.</p>{error ? <Notice type="error">{error}</Notice> : null}<div><button onClick={copyCode} disabled={saving}>Copy code</button><button className="admin-primary" onClick={closeAfterCreate} disabled={saving}>{saving ? 'Refreshing…' : 'Done'}</button></div></div> : <form onSubmit={submit}>
      <div className="management-form-grid"><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>Email (recommended)<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="working_doctor">Working doctor</option><option value="receptionist">Receptionist</option></select></label></div>
      <label>Invitation reason<textarea rows="3" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Example: Adding evening-shift doctor" required /></label>
      {error ? <Notice type="error">{error}</Notice> : null}
      <div className="management-drawer-actions"><button type="button" onClick={onClose}>Cancel</button><button className="admin-primary" disabled={saving}>{saving ? 'Creating…' : 'Create secure invite'}</button></div>
    </form>}
  </div></div>;
}

function TeamTab({ overview, actor, onReload }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');
  const staff = useMemo(() => (overview.staff || []).filter((row) => `${row.name} ${row.email} ${row.phone || ''} ${row.role}`.toLowerCase().includes(search.toLowerCase())), [overview.staff, search]);
  const active = (overview.staff || []).filter((row) => row.active).length;
  const doctors = (overview.staff || []).filter((row) => ['owner', 'head_doctor', 'working_doctor', 'doctor'].includes(row.role) && row.active).length;
  const receptionists = (overview.staff || []).filter((row) => row.role === 'receptionist' && row.active).length;

  function canEdit(row) {
    if (row.id === actor.id || row.role === 'owner') return false;
    if (actor.role === 'head_doctor' && row.role === 'head_doctor') return false;
    return true;
  }

  async function cancelInvite() {
    if (!cancelTarget) return;
    setError('');
    try {
      await cancelStaffInvite(cancelTarget.id, cancelReason);
      setCancelTarget(null); setCancelReason('');
      await onReload();
    } catch (err) { setError(err?.message || 'Unable to cancel invitation.'); }
  }

  return <>
    <section className="management-kpis"><article><span>Active staff</span><strong>{active}</strong></article><article><span>Clinical team</span><strong>{doctors}</strong></article><article><span>Receptionists</span><strong>{receptionists}</strong></article><article><span>Pending invites</span><strong>{overview.pending_invites?.length || 0}</strong></article></section>
    <section className="admin-panel management-toolbar"><div><h2>Clinic team</h2><p>Monthly activity counts show workload, not a public employee ranking.</p></div><div><input placeholder="Search staff" value={search} onChange={(event) => setSearch(event.target.value)} /><button className="admin-primary" onClick={() => setInviting(true)}>Invite staff</button></div></section>
    <section className="admin-panel management-table-wrap"><table className="management-table"><thead><tr><th>Staff</th><th>Role</th><th>Status</th><th>Patients</th><th>Appointments</th><th>Visits</th><th>Payments</th><th>Uploads</th><th>Changes</th><th>Actions</th></tr></thead><tbody>{staff.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.email}<br />{row.phone || 'No phone'}</small></td><td>{roleLabel(row.role)}</td><td><span className={`management-status ${row.active ? 'active' : 'inactive'}`}>{row.active ? 'Active' : 'Inactive'}</span></td><td>{row.activity?.patients_created || 0}</td><td>{row.activity?.appointments_created || 0}</td><td>{row.activity?.visits_created || 0}</td><td>{row.activity?.payments_recorded || 0}</td><td>{row.activity?.files_uploaded || 0}</td><td><strong>{row.activity?.records_modified || 0}</strong><small>{activityTotal(row.activity)} total actions</small></td><td>{canEdit(row) ? <button onClick={() => setEditing(row)}>Manage</button> : <span className="management-muted">Protected</span>}</td></tr>)}</tbody></table>{!staff.length ? <div className="admin-empty">No staff members match this search.</div> : null}</section>
    <section className="admin-panel"><div className="management-panel-head"><div><h2>Pending invitations</h2><p>Cancelled codes become invalid immediately.</p></div></div>{overview.pending_invites?.length ? <div className="management-invites">{overview.pending_invites.map((invite) => <article key={invite.id}><div><strong>{invite.name}</strong><small>{invite.email || 'Email unrestricted'} · {roleLabel(invite.role)}</small></div><code>{invite.invite_code}</code><span>{dateLabel(invite.created_at)}</span><button onClick={() => { setCancelTarget(invite); setCancelReason(''); }}>Cancel</button></article>)}</div> : <div className="admin-empty">No pending invitations.</div>}</section>
    {error ? <Notice type="error">{error}</Notice> : null}
    {editing ? <StaffEditor staff={editing} actor={actor} onClose={() => setEditing(null)} onSaved={onReload} /> : null}
    {inviting ? <InviteForm onClose={() => setInviting(false)} onSaved={onReload} /> : null}
    {cancelTarget ? <div className="management-overlay"><div className="management-confirm"><h2>Cancel invitation?</h2><p>The code <strong>{cancelTarget.invite_code}</strong> will stop working.</p><label>Reason<textarea rows="3" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} required /></label><div><button onClick={() => setCancelTarget(null)}>Keep invite</button><button className="management-danger" onClick={cancelInvite} disabled={cancelReason.trim().length < 3}>Cancel invitation</button></div></div></div> : null}
  </>;
}

function ClinicTab({ clinic, onSaved }) {
  const [form, setForm] = useState({
    name: clinic.name || '', phone: clinic.phone || '', email: clinic.email || '', address: clinic.address || '',
    brand_color: clinic.brand_color || '#0F766E', opening_time: String(clinic.opening_time || '09:00').slice(0, 5), closing_time: String(clinic.closing_time || '21:00').slice(0, 5),
    op_fee_amount: clinic.op_fee_amount ?? 300, enable_patient_photos: Boolean(clinic.enable_patient_photos),
    enable_prescription_medications: Boolean(clinic.enable_prescription_medications), payment_push_enabled: Boolean(clinic.payment_push_enabled),
    tooth_chart_enabled: Boolean(clinic.tooth_chart_enabled), reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setForm((current) => ({ ...current, name: clinic.name || '', phone: clinic.phone || '', email: clinic.email || '', address: clinic.address || '', brand_color: clinic.brand_color || '#0F766E', opening_time: String(clinic.opening_time || '09:00').slice(0, 5), closing_time: String(clinic.closing_time || '21:00').slice(0, 5), op_fee_amount: clinic.op_fee_amount ?? 300, enable_patient_photos: Boolean(clinic.enable_patient_photos), enable_prescription_medications: Boolean(clinic.enable_prescription_medications), payment_push_enabled: Boolean(clinic.payment_push_enabled), tooth_chart_enabled: Boolean(clinic.tooth_chart_enabled) })), [clinic]);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try { await updateClinicSettings(form); setMessage('Clinic settings updated and audited.'); setForm((value) => ({ ...value, reason: '' })); await onSaved(); }
    catch (err) { setError(err?.message || 'Unable to save clinic settings.'); }
    finally { setSaving(false); }
  }

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <form className="admin-panel management-settings" onSubmit={submit}>
    <div className="management-panel-head"><div><h2>Clinic identity and operations</h2><p>Country and currency remain locked because they affect historical financial records.</p></div><span className="management-brand-preview" style={{ background: form.brand_color }}>CD</span></div>
    <div className="management-form-grid"><label>Clinic name<input value={form.name} onChange={(event) => set('name', event.target.value)} required /></label><label>Phone<input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></label><label>Email<input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></label><label>Brand colour<input type="color" value={form.brand_color} onChange={(event) => set('brand_color', event.target.value)} /></label><label>Opening time<input type="time" value={form.opening_time} onChange={(event) => set('opening_time', event.target.value)} required /></label><label>Closing time<input type="time" value={form.closing_time} onChange={(event) => set('closing_time', event.target.value)} required /></label><label>Default OP fee<input type="number" min="0" step="1" value={form.op_fee_amount} onChange={(event) => set('op_fee_amount', event.target.value)} /></label><label>Country / currency<input value={`${clinic.country_code || 'IN'} / ${clinic.currency_code || 'INR'}`} disabled /></label></div>
    <label>Clinic address<textarea rows="3" value={form.address} onChange={(event) => set('address', event.target.value)} /></label>
    <div className="management-toggles">{[
      ['enable_patient_photos', 'Patient photographs', 'Allow patient profile and clinical photographs.'],
      ['enable_prescription_medications', 'Prescription medications', 'Enable medication entry in prescriptions.'],
      ['payment_push_enabled', 'Payment push notifications', 'Notify eligible owner/head-doctor devices for new positive payments.'],
      ['tooth_chart_enabled', 'Dental chart', 'Allow dentists to save odontogram entries.'],
    ].map(([key, title, description]) => <label className="management-toggle" key={key}><input type="checkbox" checked={form[key]} onChange={(event) => set(key, event.target.checked)} /><span><strong>{title}</strong><small>{description}</small></span></label>)}</div>
    <label>Settings-change reason<textarea rows="3" value={form.reason} onChange={(event) => set('reason', event.target.value)} placeholder="Example: Clinic timing changed from this month" required /></label>
    {message ? <Notice>{message}</Notice> : null}{error ? <Notice type="error">{error}</Notice> : null}
    <div className="management-save-row"><button className="admin-primary" disabled={saving}>{saving ? 'Saving…' : 'Save audited settings'}</button></div>
  </form>;
}

function StorageTab({ storage = {} }) {
  const max = Math.max(...(storage.by_type || []).map((row) => Number(row.stored_bytes || 0)), 1);
  return <><section className="management-kpis"><article><span>Clinical files</span><strong>{storage.total_files || 0}</strong></article><article><span>Stored size tracked</span><strong>{sizeLabel(storage.stored_bytes)}</strong></article><article><span>Original size</span><strong>{sizeLabel(storage.original_bytes)}</strong></article><article><span>Size not recorded</span><strong>{storage.unknown_size_files || 0}</strong></article></section><section className="admin-panel"><div className="management-panel-head"><div><h2>Storage by file type</h2><p>Deletion is intentionally unavailable until database and object-storage removal can run transactionally.</p></div></div><div className="management-storage-bars">{(storage.by_type || []).map((row) => <div key={row.file_type}><span>{roleLabel(row.file_type)}</span><div><i style={{ width: `${Number(row.stored_bytes || 0) / max * 100}%` }} /></div><strong>{row.file_count} · {sizeLabel(row.stored_bytes)}</strong></div>)}</div>{!storage.by_type?.length ? <div className="admin-empty">No clinical files recorded.</div> : null}</section></>;
}

function SubscriptionTab({ subscription = {}, devices = {}, currency }) {
  return <div className="management-two-column"><section className="admin-panel"><div className="management-panel-head"><div><h2>Subscription</h2><p>Billing state is read-only and controlled by Google Play or CapDent administration.</p></div></div><dl className="management-details"><div><dt>Plan</dt><dd>{roleLabel(subscription.plan_name || 'free')}</dd></div><div><dt>Status</dt><dd>{roleLabel(subscription.status || 'free')}</dd></div><div><dt>Monthly price</dt><dd>{money(subscription.monthly_price, currency)}</dd></div><div><dt>Visit limit</dt><dd>{subscription.visit_limit ?? 'Unlimited / not configured'}</dd></div><div><dt>Billing provider</dt><dd>{roleLabel(subscription.billing_provider || 'manual')}</dd></div><div><dt>Google Play</dt><dd>{roleLabel(subscription.google_play_status || 'not_started')}</dd></div><div><dt>Auto-renew</dt><dd>{subscription.google_play_auto_renewing ? 'Enabled' : 'Not enabled'}</dd></div><div><dt>Trial ends</dt><dd>{dateLabel(subscription.trial_ends_at)}</dd></div><div><dt>Current period ends</dt><dd>{dateLabel(subscription.current_period_end)}</dd></div><div><dt>Last verified</dt><dd>{dateLabel(subscription.google_play_last_verified_at)}</dd></div></dl></section><section className="admin-panel"><div className="management-panel-head"><div><h2>Notification devices</h2><p>Only aggregate device health is shown; push tokens are never exposed.</p></div></div><dl className="management-details"><div><dt>Active tokens</dt><dd>{devices.active_tokens || 0}</dd></div><div><dt>Inactive tokens</dt><dd>{devices.inactive_tokens || 0}</dd></div><div><dt>Users with active tokens</dt><dd>{devices.users_with_active_tokens || 0}</dd></div><div><dt>Tokens with errors</dt><dd>{devices.error_tokens || 0}</dd></div><div><dt>Last device activity</dt><dd>{dateLabel(devices.last_seen_at)}</dd></div></dl></section></div>;
}

function AuditTab({ audit = [] }) {
  return <section className="admin-panel"><div className="management-panel-head"><div><h2>Management audit history</h2><p>Staff invitations, access changes and clinic setting modifications.</p></div></div><div className="management-audit">{audit.map((row) => <article key={row.id}><span>{row.target_type}</span><div><strong>{roleLabel(row.action)} · {roleLabel(row.field_name)}</strong><p>{row.old_value ?? '—'} → {row.new_value ?? '—'}</p><small>{row.reason} · {row.changed_by?.name || 'System'} · {dateLabel(row.created_at)}</small></div></article>)}</div>{!audit.length ? <div className="admin-empty">No management changes have been recorded.</div> : null}</section>;
}

export default function ManagementAdmin({ profile, clinic, monthStart, mode = 'staff', onChanged }) {
  const [overview, setOverview] = useState(EMPTY);
  const [currentClinic, setCurrentClinic] = useState(clinic);
  const [tab, setTab] = useState(mode === 'settings' ? 'clinic' : 'team');
  const [month, setMonth] = useState(monthValue(monthStart));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true); setError('');
    try { setOverview(await loadManagementOverview(`${month}-01`)); }
    catch (err) { setError(err?.message || 'Unable to load clinic management.'); }
    finally { setLoading(false); }
  }

  async function reloadAll() {
    await reload();
    if (onChanged) {
      const result = await onChanged();
      if (result?.clinic) setCurrentClinic(result.clinic);
    }
  }

  useEffect(() => { setTab(mode === 'settings' ? 'clinic' : 'team'); }, [mode]);
  useEffect(() => { setCurrentClinic(clinic); }, [clinic]);
  useEffect(() => { reload(); }, [month, profile.id]);

  return <div className="management-admin"><div className="admin-section-title"><h2>{mode === 'settings' ? 'Clinic management' : 'Doctors and staff'}</h2><p>Owner-controlled access, operations, subscription visibility and monthly activity.</p></div><section className="admin-panel management-tabs"><div>{[['team','Team'],['clinic','Clinic settings'],['storage','Storage'],['subscription','Subscription & devices'],['audit','Audit history']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div><label>Activity month<input type="month" value={month} max={new Date().toISOString().slice(0, 7)} onChange={(event) => setMonth(event.target.value)} /></label></section>{error ? <Notice type="error">{error}</Notice> : null}{loading ? <section className="admin-panel admin-empty">Loading clinic management…</section> : <>{tab === 'team' ? <TeamTab overview={overview} actor={profile} onReload={reloadAll} /> : null}{tab === 'clinic' ? <ClinicTab clinic={currentClinic} onSaved={reloadAll} /> : null}{tab === 'storage' ? <StorageTab storage={overview.storage} /> : null}{tab === 'subscription' ? <SubscriptionTab subscription={overview.subscription} devices={overview.devices} currency={currentClinic.currency_code} /> : null}{tab === 'audit' ? <AuditTab audit={overview.audit} /> : null}</>}</div>;
}

