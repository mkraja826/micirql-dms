import React, { useEffect, useMemo, useState } from 'react';
import './appointment-admin.css';
import { createAdminAppointment, loadAppointmentAdmin, loadAppointmentAudit, updateAdminAppointment } from './appointment-admin-data';

const dateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const dateText = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const blank = { patient_id: '', doctor_id: '', appointment_time: '', status: 'scheduled', notes: '', reason: '' };

export default function AppointmentAdmin({ profile, monthStart, monthEnd, onChanged }) {
  const [data, setData] = useState({ appointments: [], patients: [], doctors: [] });
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blank);
  const [audit, setAudit] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const rows = await loadAppointmentAdmin(profile, monthStart, monthEnd);
    setData(rows);
    if (selected) {
      const current = rows.appointments.find((row) => row.id === selected.id);
      if (current) await selectAppointment(current);
      else {
        setSelected(null);
        setAudit([]);
        setForm(blank);
      }
    }
  }

  useEffect(() => { refresh().catch((error) => setMessage(error.message)); }, [profile.clinic_id, monthStart, monthEnd]);

  async function selectAppointment(row) {
    setSelected(row);
    setForm({ patient_id: row.patient_id, doctor_id: row.doctor_id || '', appointment_time: dateTimeLocal(row.appointment_time), status: row.status, notes: row.notes || '', reason: '' });
    try { setAudit(await loadAppointmentAudit(profile, row.id)); } catch (error) { setMessage(error.message); }
  }

  function startCreate() {
    setSelected(null);
    setAudit([]);
    setForm({ ...blank, appointment_time: dateTimeLocal(new Date(Date.now() + 3600000)) });
    setMessage('');
  }

  async function save(event) {
    event.preventDefault();
    if (!form.patient_id || !form.appointment_time || form.reason.trim().length < 3) {
      setMessage('Select a patient, date and time, and enter a reason.');
      return;
    }
    setSaving(true); setMessage('');
    try {
      if (selected) await updateAdminAppointment(selected.id, form);
      else await createAdminAppointment(form);
      setMessage(selected ? 'Appointment updated and audited.' : 'Appointment created and audited.');
      await refresh();
      await onChanged?.();
    } catch (error) { setMessage(error.message || 'Unable to save appointment.'); }
    finally { setSaving(false); }
  }

  const filtered = useMemo(() => data.appointments.filter((row) => {
    const match = [row.patient?.name, row.patient?.phone, row.doctor?.name, row.status].join(' ').toLowerCase().includes(search.toLowerCase());
    return match && (statusFilter === 'all' || row.status === statusFilter);
  }), [data.appointments, search, statusFilter]);

  const totals = ['scheduled', 'waiting', 'completed', 'cancelled', 'no_show'].map((status) => ({ status, count: data.appointments.filter((row) => row.status === status).length }));

  return <div className="appointment-admin">
    <div className="admin-section-title appointment-title"><div><h2>Appointment administration</h2><p>Create, reschedule, assign doctors and update patient status with complete audit history.</p></div><button className="admin-primary" onClick={startCreate}>+ New appointment</button></div>
    <div className="appointment-stats">{totals.map((item) => <article key={item.status}><span>{item.status.replaceAll('_', ' ')}</span><strong>{item.count}</strong></article>)}</div>
    <div className="appointment-layout">
      <section className="admin-panel appointment-list-panel">
        <div className="appointment-toolbar"><input placeholder="Search patient, phone or doctor" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option>{totals.map((item) => <option key={item.status} value={item.status}>{item.status.replaceAll('_', ' ')}</option>)}</select></div>
        <div className="appointment-list">{filtered.map((row) => <button key={row.id} className={selected?.id === row.id ? 'selected' : ''} onClick={() => selectAppointment(row)}><div><strong>{row.patient?.name || 'Unknown patient'}</strong><span>{row.patient?.phone || 'No phone'} · {row.doctor?.name || 'Unassigned'}</span></div><div><b>{dateText(row.appointment_time)}</b><em className={`appointment-status ${row.status}`}>{row.status.replaceAll('_', ' ')}</em></div></button>)}{!filtered.length && <div className="admin-empty">No appointments match this selected period and filter.</div>}</div>
      </section>
      <section className="admin-panel appointment-editor">
        <div className="admin-panel-head"><div><h2>{selected ? 'Modify appointment' : 'Create appointment'}</h2><p>{selected ? 'Every changed field is preserved in audit history.' : 'Creates a scheduled appointment in the shared Android database.'}</p></div></div>
        <form onSubmit={save} className="appointment-form">
          <label>Patient<select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} required><option value="">Select active patient</option>{data.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} {patient.phone ? `· ${patient.phone}` : ''}</option>)}</select></label>
          <label>Doctor<select value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}><option value="">Unassigned</option>{data.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
          <label>Date and time<input type="datetime-local" value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} required /></label>
          {selected && <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="scheduled">Scheduled</option><option value="waiting">Waiting</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select></label>}
          <label>Notes<textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <label>Reason for {selected ? 'modification' : 'creation'}<textarea rows="2" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Required for audit history" required /></label>
          {message && <div className="appointment-message">{message}</div>}
          <button className="admin-primary" disabled={saving}>{saving ? 'Saving…' : selected ? 'Save audited changes' : 'Create appointment'}</button>
        </form>
        {selected && <div className="appointment-audit"><h3>Appointment history</h3>{audit.map((item) => <article key={item.id}><strong>{item.action.replaceAll('_', ' ')} · {item.field_name.replaceAll('_', ' ')}</strong><p>{item.old_value || '—'} → {item.new_value || '—'}</p><small>{item.reason} · {item.changedBy?.name || 'Clinic admin'} · {dateText(item.created_at)}</small></article>)}{!audit.length && <div className="admin-empty">No recorded changes yet.</div>}</div>}
      </section>
    </div>
  </div>;
}
