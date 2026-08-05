import React, { useEffect, useMemo, useState } from 'react';
import './clinical-admin.css';
import {
  addDentalChartCorrection,
  loadClinicalMonth,
  loadClinicalVisitDetails,
  updateClinicalTreatment,
  updateClinicalVisit,
} from './clinical-admin-data';

const EMPTY_DETAILS = { treatments: [], chartEntries: [], audits: [] };
const CONDITIONS = ['healthy', 'caries', 'filled', 'missing', 'crown', 'root_canal', 'implant', 'extraction_planned', 'unerupted'];
const SURFACES = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual'];
const PERMANENT_TEETH = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28','48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];
const PRIMARY_TEETH = ['55','54','53','52','51','61','62','63','64','65','85','84','83','82','81','71','72','73','74','75'];

const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const dateText = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};
const statusLabel = (value) => String(value || 'unknown').replaceAll('_', ' ');

function Notice({ message, onClose }) {
  if (!message) return null;
  return <div className={`clinical-notice ${message.tone || 'success'}`} role="status"><span>{message.text}</span><button type="button" onClick={onClose}>×</button></div>;
}

function ToothGrid({ title, codes, dentition, entries, onSelect }) {
  const latest = new Map();
  [...entries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach((entry) => {
    if (entry.dentition === dentition && !latest.has(entry.tooth_code)) latest.set(entry.tooth_code, entry);
  });
  return <section className="tooth-chart-section"><div className="tooth-chart-title"><strong>{title}</strong><small>FDI notation · click a tooth to add a corrective entry</small></div><div className="tooth-grid">{codes.map((code) => { const entry = latest.get(code); return <button type="button" key={code} className={`tooth-cell ${entry ? `condition-${entry.condition}` : 'not-charted'}`} onClick={() => onSelect(code, dentition, entry)}><b>{code}</b><span>{entry ? statusLabel(entry.condition) : 'Not charted'}</span>{entry ? <small>{statusLabel(entry.treatment_status)}</small> : null}</button>; })}</div></section>;
}

export default function ClinicalAdmin({ profile, monthStart, monthEnd, currency = 'INR', onChanged }) {
  const [bundle, setBundle] = useState({ visits: [], doctors: [], treatments: [], chartEntries: [] });
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [visitForm, setVisitForm] = useState(null);
  const [visitReason, setVisitReason] = useState('');
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [treatmentForm, setTreatmentForm] = useState(null);
  const [treatmentReason, setTreatmentReason] = useState('');
  const [chartForm, setChartForm] = useState({ tooth_code: '', dentition: 'permanent', condition: 'healthy', surfaces: [], notes: '', treatment_name: '', treatment_status: 'planned' });
  const [chartReason, setChartReason] = useState('');

  async function loadMonth(keepSelection = true) {
    setLoading(true);
    try {
      const result = await loadClinicalMonth(profile, monthStart, monthEnd);
      setBundle(result);
      if (keepSelection && selectedId && result.visits.some((visit) => visit.id === selectedId)) {
        await openVisit(selectedId, result.visits);
      } else if (!result.visits.some((visit) => visit.id === selectedId)) {
        setSelectedId(null);
        setDetails(EMPTY_DETAILS);
      }
    } catch (error) {
      setMessage({ tone: 'error', text: error?.message || 'Unable to load clinical records.' });
    } finally {
      setLoading(false);
    }
  }

  async function openVisit(visitId, source = bundle.visits) {
    const visit = source.find((row) => row.id === visitId);
    if (!visit) return;
    setSelectedId(visitId);
    setVisitForm({
      doctor_id: visit.doctor_id || '',
      visit_date: toLocalInput(visit.visit_date),
      chief_complaint: visit.chief_complaint || '',
      diagnosis: visit.diagnosis || '',
      doctor_notes: visit.doctor_notes || '',
      next_appointment_date: toLocalInput(visit.next_appointment_date),
    });
    setVisitReason('');
    setEditingTreatment(null);
    setTreatmentForm(null);
    setDetailLoading(true);
    try {
      setDetails(await loadClinicalVisitDetails(profile, visitId));
    } catch (error) {
      setMessage({ tone: 'error', text: error?.message || 'Unable to load visit details.' });
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => { loadMonth(false); }, [profile.id, monthStart, monthEnd]);

  const selected = bundle.visits.find((visit) => visit.id === selectedId) || null;
  const filteredVisits = useMemo(() => bundle.visits.filter((visit) => {
    const haystack = [visit.patient?.name, visit.patient?.phone, visit.patient?.patient_code, visit.doctor?.name, visit.chief_complaint, visit.diagnosis].join(' ').toLowerCase();
    const matchesSearch = haystack.includes(search.trim().toLowerCase());
    const matchesDoctor = doctorFilter === 'all' || (doctorFilter === 'unassigned' ? !visit.doctor_id : visit.doctor_id === doctorFilter);
    return matchesSearch && matchesDoctor;
  }), [bundle.visits, search, doctorFilter]);

  const summary = {
    visits: bundle.visits.length,
    patients: new Set(bundle.visits.map((visit) => visit.patient_id)).size,
    treatments: bundle.treatments.length,
    ongoing: bundle.treatments.filter((treatment) => treatment.status === 'ongoing').length,
    charted: bundle.chartEntries.length,
  };

  async function saveVisit(event) {
    event.preventDefault();
    if (!visitReason.trim()) return setMessage({ tone: 'error', text: 'Enter a reason for the clinical correction.' });
    setSaving(true);
    try {
      await updateClinicalVisit(selectedId, visitForm, visitReason);
      setMessage({ tone: 'success', text: 'Clinical visit updated and recorded in the audit history.' });
      await loadMonth(true);
      await onChanged?.();
    } catch (error) {
      setMessage({ tone: 'error', text: error?.message || 'Unable to update the visit.' });
    } finally {
      setSaving(false);
    }
  }

  function startTreatmentEdit(treatment) {
    setEditingTreatment(treatment.id);
    setTreatmentForm({ treatment_name: treatment.treatment_name || '', description: treatment.description || '', category: treatment.category || '', status: treatment.status || 'planned' });
    setTreatmentReason('');
  }

  async function saveTreatment(event) {
    event.preventDefault();
    if (!treatmentReason.trim()) return setMessage({ tone: 'error', text: 'Enter a reason for the treatment correction.' });
    setSaving(true);
    try {
      await updateClinicalTreatment(editingTreatment, treatmentForm, treatmentReason);
      setMessage({ tone: 'success', text: 'Treatment updated without altering its financial value.' });
      setDetails(await loadClinicalVisitDetails(profile, selectedId));
      await loadMonth(false);
      setEditingTreatment(null);
      setTreatmentForm(null);
      await onChanged?.();
    } catch (error) {
      setMessage({ tone: 'error', text: error?.message || 'Unable to update the treatment.' });
    } finally {
      setSaving(false);
    }
  }

  function selectTooth(code, dentition, entry) {
    setChartForm({
      tooth_code: code,
      dentition,
      condition: entry?.condition || 'healthy',
      surfaces: entry?.surfaces || [],
      notes: entry?.notes || '',
      treatment_name: entry?.treatment_name || '',
      treatment_status: entry?.treatment_status || 'planned',
    });
    setChartReason('');
  }

  function toggleSurface(surface) {
    setChartForm((current) => ({ ...current, surfaces: current.surfaces.includes(surface) ? current.surfaces.filter((item) => item !== surface) : [...current.surfaces, surface] }));
  }

  async function saveChartCorrection(event) {
    event.preventDefault();
    if (!chartForm.tooth_code) return setMessage({ tone: 'error', text: 'Select a tooth from the chart.' });
    if (!chartReason.trim()) return setMessage({ tone: 'error', text: 'Enter a reason for the chart correction.' });
    setSaving(true);
    try {
      await addDentalChartCorrection(selectedId, chartForm, chartReason);
      setMessage({ tone: 'success', text: `Corrective chart entry added for tooth ${chartForm.tooth_code}. Historical entries were preserved.` });
      setDetails(await loadClinicalVisitDetails(profile, selectedId));
      await loadMonth(false);
      setChartReason('');
      await onChanged?.();
    } catch (error) {
      setMessage({ tone: 'error', text: error?.message || 'Unable to add the chart correction.' });
    } finally {
      setSaving(false);
    }
  }

  return <div className="clinical-admin">
    <div className="admin-section-title"><h2>Clinical administration</h2><p>Correct visits, reassign doctors, update treatment progress and review append-only dental chart history.</p></div>
    <Notice message={message} onClose={() => setMessage(null)} />

    <section className="clinical-summary">
      <article><span>Visits</span><strong>{summary.visits}</strong><small>Selected month</small></article>
      <article><span>Patients treated</span><strong>{summary.patients}</strong><small>Unique patients</small></article>
      <article><span>Treatments</span><strong>{summary.treatments}</strong><small>{summary.ongoing} ongoing</small></article>
      <article><span>Chart entries</span><strong>{summary.charted}</strong><small>Append-only history</small></article>
    </section>

    <div className="clinical-layout">
      <section className="admin-panel clinical-list-panel">
        <div className="clinical-toolbar"><label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient, doctor, complaint or ID" /></label><label>Doctor<select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}><option value="all">All doctors</option><option value="unassigned">Unassigned</option>{bundle.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label></div>
        {loading ? <div className="admin-empty">Loading clinical records…</div> : <div className="clinical-visit-list">{filteredVisits.map((visit) => <button type="button" key={visit.id} className={selectedId === visit.id ? 'active' : ''} onClick={() => openVisit(visit.id)}><div><strong>{visit.patient?.name || 'Unknown patient'}</strong><small>{visit.patient?.patient_code || visit.patient?.phone || 'No patient ID'}</small></div><span>{dateText(visit.visit_date)}</span><p>{visit.chief_complaint || 'No chief complaint recorded'}</p><footer><b>{visit.doctor?.name || 'Unassigned doctor'}</b><em>{statusLabel(visit.visit_status || 'completed')}</em></footer></button>)}</div>}
        {!loading && !filteredVisits.length ? <div className="admin-empty">No matching visits for this month.</div> : null}
      </section>

      <section className="clinical-detail">
        {!selected ? <div className="admin-panel clinical-select-prompt"><strong>Select a visit</strong><p>Open a visit to manage clinical details, treatments, dental-chart history and audit records.</p></div> : detailLoading ? <div className="admin-panel admin-empty">Loading visit details…</div> : <>
          <section className="admin-panel clinical-visit-editor">
            <div className="clinical-detail-head"><div><h3>{selected.patient?.name || 'Unknown patient'}</h3><p>{dateText(selected.visit_date)} · {selected.doctor?.name || 'Unassigned doctor'}</p></div><span className="clinical-status">{statusLabel(selected.visit_status || 'completed')}</span></div>
            <form className="clinical-form" onSubmit={saveVisit}>
              <div className="clinical-form-grid"><label>Treating doctor<select value={visitForm?.doctor_id || ''} onChange={(event) => setVisitForm({ ...visitForm, doctor_id: event.target.value })}><option value="">Unassigned</option>{bundle.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label><label>Visit date and time<input type="datetime-local" value={visitForm?.visit_date || ''} onChange={(event) => setVisitForm({ ...visitForm, visit_date: event.target.value })} required /></label></div>
              <label>Chief complaint<textarea rows="3" value={visitForm?.chief_complaint || ''} onChange={(event) => setVisitForm({ ...visitForm, chief_complaint: event.target.value })} /></label>
              <label>Diagnosis<textarea rows="3" value={visitForm?.diagnosis || ''} onChange={(event) => setVisitForm({ ...visitForm, diagnosis: event.target.value })} /></label>
              <label>Doctor notes<textarea rows="4" value={visitForm?.doctor_notes || ''} onChange={(event) => setVisitForm({ ...visitForm, doctor_notes: event.target.value })} /></label>
              <label>Recorded follow-up date<input type="datetime-local" value={visitForm?.next_appointment_date || ''} onChange={(event) => setVisitForm({ ...visitForm, next_appointment_date: event.target.value })} /><small>Changing this field does not silently reschedule a separate appointment. Use Appointment Administration for the calendar booking.</small></label>
              <label>Reason for modification<textarea rows="2" value={visitReason} onChange={(event) => setVisitReason(event.target.value)} placeholder="Required for audit history" required /></label>
              <button className="clinical-primary" disabled={saving}>{saving ? 'Saving clinical changes…' : 'Save audited visit changes'}</button>
            </form>
          </section>

          <section className="admin-panel clinical-treatments">
            <div className="clinical-section-head"><div><h3>Treatments</h3><p>Clinical fields can be corrected. Cost remains read-only until the finance ledger milestone.</p></div><span>{details.treatments.length} records</span></div>
            <div className="clinical-treatment-list">{details.treatments.map((treatment) => <article key={treatment.id}><div><strong>{treatment.treatment_name}</strong><small>{treatment.category || 'Uncategorised'} · {statusLabel(treatment.status)}</small></div><p>{treatment.description || 'No description'}</p><footer><b>{money(treatment.cost, currency)}</b><button type="button" onClick={() => startTreatmentEdit(treatment)}>Edit clinical details</button></footer></article>)}</div>
            {!details.treatments.length ? <div className="admin-empty">No treatments are linked to this visit.</div> : null}
            {editingTreatment && treatmentForm ? <form className="clinical-form treatment-edit-form" onSubmit={saveTreatment}><h4>Edit treatment</h4><div className="clinical-form-grid"><label>Treatment name<input value={treatmentForm.treatment_name} onChange={(event) => setTreatmentForm({ ...treatmentForm, treatment_name: event.target.value })} required /></label><label>Status<select value={treatmentForm.status} onChange={(event) => setTreatmentForm({ ...treatmentForm, status: event.target.value })}><option value="planned">Planned</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option></select></label></div><label>Category<input value={treatmentForm.category} onChange={(event) => setTreatmentForm({ ...treatmentForm, category: event.target.value })} /></label><label>Description<textarea rows="3" value={treatmentForm.description} onChange={(event) => setTreatmentForm({ ...treatmentForm, description: event.target.value })} /></label><label>Reason for modification<textarea rows="2" value={treatmentReason} onChange={(event) => setTreatmentReason(event.target.value)} required /></label><div className="clinical-action-row"><button className="clinical-primary" disabled={saving}>Save treatment changes</button><button type="button" onClick={() => { setEditingTreatment(null); setTreatmentForm(null); }}>Cancel</button></div></form> : null}
          </section>

          <section className="admin-panel clinical-chart-panel">
            <div className="clinical-section-head"><div><h3>Dental chart review</h3><p>Historical entries cannot be overwritten. Corrections create a new dated entry.</p></div><span>{details.chartEntries.length} entries</span></div>
            <ToothGrid title="Permanent dentition" codes={PERMANENT_TEETH} dentition="permanent" entries={details.chartEntries} onSelect={selectTooth} />
            <ToothGrid title="Primary dentition" codes={PRIMARY_TEETH} dentition="primary" entries={details.chartEntries} onSelect={selectTooth} />
            <form className="clinical-form chart-correction-form" onSubmit={saveChartCorrection}><h4>Add corrective chart entry</h4><div className="clinical-form-grid"><label>Tooth code<input value={chartForm.tooth_code} readOnly placeholder="Select a tooth above" /></label><label>Dentition<select value={chartForm.dentition} onChange={(event) => setChartForm({ ...chartForm, dentition: event.target.value, tooth_code: '' })}><option value="permanent">Permanent</option><option value="primary">Primary</option></select></label><label>Condition<select value={chartForm.condition} onChange={(event) => setChartForm({ ...chartForm, condition: event.target.value })}>{CONDITIONS.map((condition) => <option key={condition} value={condition}>{statusLabel(condition)}</option>)}</select></label><label>Treatment status<select value={chartForm.treatment_status} onChange={(event) => setChartForm({ ...chartForm, treatment_status: event.target.value })}><option value="planned">Planned</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option></select></label></div><fieldset><legend>Surfaces</legend><div className="surface-options">{SURFACES.map((surface) => <label key={surface}><input type="checkbox" checked={chartForm.surfaces.includes(surface)} onChange={() => toggleSurface(surface)} />{surface}</label>)}</div></fieldset><label>Treatment name<input value={chartForm.treatment_name} onChange={(event) => setChartForm({ ...chartForm, treatment_name: event.target.value })} /></label><label>Clinical notes<textarea rows="3" value={chartForm.notes} onChange={(event) => setChartForm({ ...chartForm, notes: event.target.value })} /></label><label>Reason for correction<textarea rows="2" value={chartReason} onChange={(event) => setChartReason(event.target.value)} required /></label><button className="clinical-primary" disabled={saving || !chartForm.tooth_code}>Append corrective chart entry</button></form>
            <div className="chart-history"><h4>Recorded chart history</h4>{details.chartEntries.map((entry) => <article key={entry.id}><b>Tooth {entry.tooth_code}</b><span>{statusLabel(entry.condition)} · {statusLabel(entry.treatment_status)}</span><small>{dateText(entry.created_at)}{entry.surfaces?.length ? ` · ${entry.surfaces.join(', ')}` : ''}</small><p>{entry.notes || entry.treatment_name || 'No additional notes'}</p></article>)}</div>
          </section>

          <section className="admin-panel clinical-audit-panel"><div className="clinical-section-head"><div><h3>Clinical audit history</h3><p>Every field correction, doctor reassignment and chart addition.</p></div><span>{details.audits.length} changes</span></div><div className="clinical-audit-list">{details.audits.map((audit) => <article key={audit.id}><div><strong>{statusLabel(audit.action)}</strong><span>{audit.field_name}</span></div><p><b>{audit.old_value || 'Empty'}</b><span>→</span><b>{audit.new_value || 'Empty'}</b></p><footer>{audit.reason} · {audit.changedBy?.name || 'Clinic administrator'} · {dateText(audit.created_at)}</footer></article>)}</div>{!details.audits.length ? <div className="admin-empty">No administrative clinical changes have been recorded for this visit.</div> : null}</section>
        </>}
      </section>
    </div>
  </div>;
}
