import React, { useMemo, useState } from 'react';
import { loadPatientHistory, setAdminPatientArchived, updateAdminPatient } from './admin-supabase';
import './patient-admin.css';

const emptyHistory = { audits: [], visits: [], appointments: [], invoices: [], payments: [], treatments: [] };
const dateText = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';

function normalisePhone(value = '') { return value.replace(/\D/g, '').slice(-10); }
function normaliseName(value = '') { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }

export default function PatientAdmin({ patients, profile, onChanged }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(emptyHistory);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const duplicateIds = useMemo(() => {
    const ids = new Set();
    const buckets = new Map();
    patients.forEach((patient) => {
      const keys = [normalisePhone(patient.phone), normaliseName(patient.name)].filter((value) => value.length >= 5);
      keys.forEach((key) => {
        const list = buckets.get(key) || [];
        list.push(patient.id);
        buckets.set(key, list);
      });
    });
    buckets.forEach((list) => { if (list.length > 1) list.forEach((id) => ids.add(id)); });
    return ids;
  }, [patients]);

  const rows = useMemo(() => patients.filter((patient) => {
    const archived = Boolean(patient.archived_at);
    if (status === 'active' && archived) return false;
    if (status === 'archived' && !archived) return false;
    const haystack = [patient.name, patient.phone, patient.email, patient.patient_code].join(' ').toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [patients, query, status]);

  async function openPatient(patient) {
    setSelected(patient);
    setEditing(false);
    setMessage(null);
    setLoadingHistory(true);
    try { setHistory(await loadPatientHistory(profile, patient.id)); }
    catch (error) { setMessage({ tone: 'error', text: error.message || 'Unable to load patient history.' }); }
    finally { setLoadingHistory(false); }
  }

  function beginEdit() {
    setForm({
      name: selected.name || '', phone: selected.phone || '', email: selected.email || '', age: selected.age ?? '',
      gender: selected.gender || '', dob: selected.dob || '', address: selected.address || '', emergency_contact: selected.emergency_contact || '',
    });
    setReason(''); setMessage(null); setEditing(true);
  }

  async function save(event) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const updated = await updateAdminPatient(selected.id, form, reason);
      setSelected(updated); setEditing(false); setReason('');
      setMessage({ tone: 'success', text: 'Patient record updated and added to the audit history.' });
      await onChanged(); await openPatient(updated);
    } catch (error) { setMessage({ tone: 'error', text: error.message || 'Unable to update patient.' }); }
    finally { setSaving(false); }
  }

  async function toggleArchive() {
    const action = selected.archived_at ? 'restore' : 'archive';
    const explanation = window.prompt(`Enter the reason to ${action} this patient record:`);
    if (!explanation) return;
    setSaving(true); setMessage(null);
    try {
      const updated = await setAdminPatientArchived(selected.id, !selected.archived_at, explanation);
      setSelected(updated);
      setMessage({ tone: 'success', text: `Patient ${action === 'archive' ? 'archived' : 'restored'} with an audit entry.` });
      await onChanged(); await openPatient(updated);
    } catch (error) { setMessage({ tone: 'error', text: error.message || `Unable to ${action} patient.` }); }
    finally { setSaving(false); }
  }

  return <div className="patient-admin-layout">
    <section className="patient-directory admin-panel">
      <div className="patient-toolbar"><div><h2>Patient database</h2><p>{rows.length} records shown · {duplicateIds.size} possible duplicates</p></div><div className="patient-filters"><input placeholder="Search name, phone, email or ID" value={query} onChange={(e) => setQuery(e.target.value)} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All records</option></select></div></div>
      <div className="patient-list">{rows.map((patient) => <button type="button" className={`patient-row ${selected?.id === patient.id ? 'selected' : ''}`} key={patient.id} onClick={() => openPatient(patient)}><span className="patient-avatar">{patient.name?.slice(0,2).toUpperCase()}</span><span><strong>{patient.name}</strong><small>{patient.phone || 'No phone'} · {patient.patient_code || patient.id.slice(0,8)}</small></span>{duplicateIds.has(patient.id) ? <em>Possible duplicate</em> : null}{patient.archived_at ? <b>Archived</b> : <b>Active</b>}</button>)}</div>
    </section>

    <section className="patient-detail admin-panel">
      {!selected ? <div className="admin-empty">Select a patient to view and administer the complete record.</div> : <>
        <div className="patient-detail-head"><div><h2>{selected.name}</h2><p>{selected.patient_code || selected.id} · Added {dateText(selected.created_at)}</p></div><div className="admin-actions"><button onClick={beginEdit}>Edit record</button><button className={selected.archived_at ? '' : 'danger'} disabled={saving} onClick={toggleArchive}>{selected.archived_at ? 'Restore' : 'Archive'}</button></div></div>
        {message ? <div className={`patient-message ${message.tone}`}>{message.text}</div> : null}
        {editing ? <form className="patient-edit-form" onSubmit={save}><div className="patient-form-grid"><label>Name<input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label>Phone<input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></label><label>Email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label><label>Age<input type="number" min="0" max="130" value={form.age} onChange={(e)=>setForm({...form,age:e.target.value})}/></label><label>Gender<select value={form.gender} onChange={(e)=>setForm({...form,gender:e.target.value})}><option value="">Not specified</option><option>Female</option><option>Male</option><option>Other</option></select></label><label>Date of birth<input type="date" value={form.dob} onChange={(e)=>setForm({...form,dob:e.target.value})}/></label><label className="wide">Address<textarea rows="2" value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})}/></label><label className="wide">Emergency contact<input value={form.emergency_contact} onChange={(e)=>setForm({...form,emergency_contact:e.target.value})}/></label><label className="wide">Reason for modification<textarea required minLength="3" rows="2" value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Explain why this patient record is being changed"/></label></div><div className="admin-actions"><button type="button" onClick={()=>setEditing(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save audited changes'}</button></div></form> : <div className="patient-summary-grid"><div><span>Phone</span><strong>{selected.phone || '—'}</strong></div><div><span>Email</span><strong>{selected.email || '—'}</strong></div><div><span>Age / gender</span><strong>{selected.age ?? '—'} / {selected.gender || '—'}</strong></div><div><span>Date of birth</span><strong>{selected.dob || '—'}</strong></div><div className="wide"><span>Address</span><strong>{selected.address || '—'}</strong></div><div className="wide"><span>Emergency contact</span><strong>{selected.emergency_contact || '—'}</strong></div></div>}
        <div className="patient-history-tabs"><h3>Complete patient history</h3>{loadingHistory ? <p>Loading history…</p> : <div className="patient-history-grid"><article><strong>{history.visits.length}</strong><span>Visits</span></article><article><strong>{history.appointments.length}</strong><span>Appointments</span></article><article><strong>{history.treatments.length}</strong><span>Treatments</span></article><article><strong>{history.payments.length}</strong><span>Payments</span></article><article><strong>{history.invoices.length}</strong><span>Invoices</span></article><article><strong>{history.audits.length}</strong><span>Changes</span></article></div>}</div>
        <div className="patient-audit-list"><h3>Modification history</h3>{history.audits.length ? history.audits.map((item)=><article key={item.id}><div><strong>{item.field_name.replaceAll('_',' ')}</strong><span>{item.old_value || 'Empty'} → {item.new_value || 'Empty'}</span></div><p>{item.reason || 'No reason'}<small>{item.changedBy?.name || 'Clinic admin'} · {dateText(item.created_at)}</small></p></article>) : <div className="admin-empty">No patient modifications recorded yet.</div>}</div>
      </>}
    </section>
  </div>;
}
