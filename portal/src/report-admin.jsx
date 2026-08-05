import React, { useEffect, useMemo, useState } from 'react';
import './report-admin.css';
import {
  loadArchivedRecords,
  loadUnifiedAudit,
  recordReportExport,
  restoreArchivedPatient,
} from './report-admin-supabase';

const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(Number(value || 0));
const dateTime = (value) => value ? new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value)) : '—';
const dateOnly = (value) => value ? new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(value)) : '—';
const monthName = (month) => new Intl.DateTimeFormat('en-IN', {
  month: 'long', year: 'numeric',
}).format(month);
const titleCase = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const asDateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
const lastPeriodDate = (periodEnd) => {
  if (!periodEnd) return null;
  const date = new Date(periodEnd);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

function spreadsheetSafe(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
function csvEscape(value) {
  const safe = spreadsheetSafe(value);
  const text = String(safe).replaceAll('"', '""');
  return `"${text}"`;
}
function xmlEscape(value) {
  return String(spreadsheetSafe(value))
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
function downloadBlob(content, mime, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click();
  anchor.remove(); URL.revokeObjectURL(url);
}
function downloadCsv(headers, rows, filename) {
  const content = `\uFEFF${[headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')}`;
  downloadBlob(content, 'text/csv;charset=utf-8', filename);
}
function downloadExcelWorkbook(sheets, filename) {
  const worksheets = sheets.map(({ name, headers, rows }) => {
    const tableRows = [headers, ...rows].map((row, rowIndex) => `<Row>${row.map((value) => {
      const isNumber = typeof value === 'number' && Number.isFinite(value);
      return `<Cell${rowIndex === 0 ? ' ss:StyleID="Header"' : ''}><Data ss:Type="${isNumber ? 'Number' : 'String'}">${xmlEscape(value)}</Data></Cell>`;
    }).join('')}</Row>`).join('');
    return `<Worksheet ss:Name="${xmlEscape(name.slice(0, 31))}"><Table>${tableRows}</Table></Worksheet>`;
  }).join('');
  const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#DDEDEA" ss:Pattern="Solid"/></Style></Styles>${worksheets}</Workbook>`;
  downloadBlob(`\uFEFF${workbook}`, 'application/vnd.ms-excel;charset=utf-8', filename);
}

function DataTable({ headers, rows, empty = 'No records found.' }) {
  if (!rows.length) return <div className="admin-empty">{empty}</div>;
  return <div className="report-table-wrap"><table className="report-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function buildDatasets(data, clinic, auditRows, archivedRows) {
  const currency = clinic.currency_code || 'INR';
  return {
    patients: {
      reportType: 'patients', headers: ['Patient ID', 'Name', 'Phone', 'Email', 'Age', 'Gender', 'Created', 'Archive status'],
      rows: (data.patients || []).map((row) => [row.id, row.name, row.phone || '', row.email || '', row.age ?? '', row.gender || '', dateOnly(row.created_at), row.archived_at ? 'Archived' : 'Active']),
    },
    appointments: {
      reportType: 'appointments', headers: ['Appointment ID', 'Date and time', 'Patient', 'Doctor', 'Status', 'Notes'],
      rows: (data.appointments || []).map((row) => [row.id, dateTime(row.appointment_time), row.patient?.name || '', row.doctor?.name || '', row.status || '', row.notes || '']),
    },
    clinical: {
      reportType: 'clinical', headers: ['Visit ID', 'Visit date', 'Patient', 'Doctor', 'Chief complaint', 'Diagnosis', 'Notes'],
      rows: (data.visits || []).map((row) => [row.id, dateTime(row.visit_date || row.created_at), row.patient?.name || '', row.doctor?.name || '', row.chief_complaint || '', row.diagnosis || '', row.notes || '']),
    },
    payments: {
      reportType: 'payments', headers: ['Payment ID', 'Date', 'Patient', 'Amount', 'Method', 'Category', 'Status', 'Notes'],
      rows: (data.payments || []).map((row) => [row.id, dateTime(row.created_at), row.patient?.name || '', Number(row.amount || 0), row.payment_method || '', row.payment_category || '', row.status || 'active', row.notes || '']),
    },
    invoices: {
      reportType: 'invoices', headers: ['Invoice ID', 'Date', 'Patient', 'Total', 'Paid', 'Due', 'Status'],
      rows: (data.invoices || []).map((row) => [row.id, dateOnly(row.created_at), row.patient?.name || '', Number(row.total_amount || 0), Number(row.paid_amount || 0), Number(row.due_amount || 0), row.status || '']),
    },
    staff_activity: {
      reportType: 'staff_activity', headers: ['Staff ID', 'Name', 'Email', 'Role', 'Access'],
      rows: (data.staff || []).map((row) => [row.id, row.name, row.email || '', row.role || '', row.active ? 'Active' : 'Inactive']),
    },
    audit: {
      reportType: 'audit', headers: ['Date', 'Source', 'Subject', 'Actor', 'Action', 'Field', 'Old value', 'New value', 'Reason', `Amount (${currency})`],
      rows: auditRows.map((row) => [dateTime(row.created_at), row.source, row.subject_name || '', row.actor_name || '', row.action || '', row.field_name || '', row.old_value || '', row.new_value || '', row.reason || '', row.amount === null ? '' : Number(row.amount)]),
    },
    archived_records: {
      reportType: 'archived_records', headers: ['Type', 'Subject', 'Status', 'Occurred', 'Reason', 'Actor', `Amount (${currency})`],
      rows: archivedRows.map((row) => [row.record_type, row.subject_name || '', row.status || '', dateTime(row.occurred_at), row.reason || '', row.actor_name || '', row.amount === null ? '' : Number(row.amount)]),
    },
  };
}

export default function ReportAdmin({ data, clinic, profile, month, initialTab = 'summary', onChanged }) {
  const [tab, setTab] = useState(initialTab);
  const [auditRows, setAuditRows] = useState([]);
  const [archivedRows, setArchivedRows] = useState([]);
  const [auditSource, setAuditSource] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditStart, setAuditStart] = useState(asDateInput(data.period?.start));
  const [auditEnd, setAuditEnd] = useState(lastPeriodDate(data.period?.end) || asDateInput(data.period?.start));
  const [archiveType, setArchiveType] = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const periodStart = asDateInput(data.period?.start);
  const periodEnd = lastPeriodDate(data.period?.end);
  const metrics = data.metrics || {};
  const currency = clinic.currency_code || 'INR';

  const treatmentSummary = useMemo(() => Object.entries((data.treatments || []).reduce((result, row) => {
    const name = row.treatment_name || 'Other'; result[name] = (result[name] || 0) + 1; return result;
  }, {})).sort((a, b) => b[1] - a[1]), [data.treatments]);

  const weeklyRows = useMemo(() => Array.from({ length: 5 }, (_, index) => {
    const startDay = index * 7 + 1;
    const endDay = Math.min(startDay + 6, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
    const inWeek = (value) => { const day = new Date(value).getDate(); return day >= startDay && day <= endDay; };
    return [
      `Week ${index + 1} (${startDay}–${endDay})`,
      (data.monthPatients || []).filter((row) => inWeek(row.created_at)).length,
      (data.appointments || []).filter((row) => inWeek(row.appointment_time)).length,
      (data.visits || []).filter((row) => inWeek(row.visit_date || row.created_at)).length,
      (data.payments || []).filter((row) => inWeek(row.created_at)).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    ];
  }), [data, month]);

  const positivePayments = (data.payments || []).filter((row) => Number(row.amount || 0) > 0).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const refunds = Math.abs((data.payments || []).filter((row) => Number(row.amount || 0) < 0).reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const datasets = useMemo(() => buildDatasets(data, clinic, auditRows, archivedRows), [data, clinic, auditRows, archivedRows]);
  const filteredArchives = archivedRows.filter((row) => !archiveType || row.record_type === archiveType);

  async function refreshAudit() {
    setBusy(true); setError(''); setMessage('');
    try {
      const start = auditStart ? new Date(`${auditStart}T00:00:00`).toISOString() : null;
      const endDate = auditEnd ? new Date(`${auditEnd}T00:00:00`) : null;
      if (endDate) endDate.setDate(endDate.getDate() + 1);
      const rows = await loadUnifiedAudit({
        start, end: endDate?.toISOString() || null, source: auditSource, search: auditSearch, limit: 500,
      });
      setAuditRows(rows);
    } catch (err) { setError(err?.message || 'Unable to load the unified audit history.'); }
    finally { setBusy(false); }
  }

  async function refreshArchives() {
    setBusy(true); setError(''); setMessage('');
    try { setArchivedRows(await loadArchivedRecords()); }
    catch (err) { setError(err?.message || 'Unable to load archived records.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (tab === 'audit' && !auditRows.length) refreshAudit();
    if (tab === 'archived' && !archivedRows.length) refreshArchives();
  }, [tab]);

  async function exportDataset(key, format) {
    const dataset = datasets[key];
    if (!dataset) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await recordReportExport({ reportType: dataset.reportType, format, periodStart, periodEnd, rowCount: dataset.rows.length });
      const base = `${clinic.name}-${dataset.reportType}-${periodStart || 'all'}`.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
      if (format === 'csv') downloadCsv(dataset.headers, dataset.rows, `${base}.csv`);
      else downloadExcelWorkbook([{ name: titleCase(dataset.reportType), headers: dataset.headers, rows: dataset.rows }], `${base}.xls`);
      setMessage(`${titleCase(format)} export created and recorded in the audit history.`);
    } catch (err) { setError(err?.message || 'The export was blocked because it could not be recorded.'); }
    finally { setBusy(false); }
  }

  async function exportFullWorkbook() {
    setBusy(true); setError(''); setMessage('');
    try {
      const keys = ['patients', 'appointments', 'clinical', 'payments', 'invoices', 'staff_activity'];
      const rowCount = keys.reduce((sum, key) => sum + datasets[key].rows.length, 0);
      await recordReportExport({ reportType: 'monthly_summary', format: 'excel', periodStart, periodEnd, rowCount });
      const summaryRows = [
        ['Month', monthName(month)], ['Clinic', clinic.name], ['New patients', metrics.newPatients || 0],
        ['Appointments', metrics.appointments || 0], ['Completed visits', metrics.visits || 0],
        ['Net billed', Number(metrics.billed || 0)], ['Payments received', positivePayments], ['Refunds', refunds],
        ['Net collection', Number(metrics.collected || 0)], ['Outstanding dues', Number(metrics.outstanding || 0)],
        ['Collection rate', `${metrics.collectionRate || 0}%`],
      ];
      const sheets = [
        { name: 'Summary', headers: ['Metric', 'Value'], rows: summaryRows },
        ...keys.map((key) => ({ name: titleCase(key), headers: datasets[key].headers, rows: datasets[key].rows })),
      ];
      downloadExcelWorkbook(sheets, `${clinic.name}-${periodStart}-clinic-report.xls`.replace(/[^a-z0-9-_.]+/gi, '-').toLowerCase());
      setMessage('Complete Excel workbook created and recorded in the audit history.');
    } catch (err) { setError(err?.message || 'The workbook export was blocked because it could not be recorded.'); }
    finally { setBusy(false); }
  }

  async function printReport() {
    setBusy(true); setError(''); setMessage('');
    try {
      await recordReportExport({
        reportType: 'monthly_summary', format: 'pdf', periodStart, periodEnd,
        rowCount: (data.patients || []).length + (data.appointments || []).length + (data.visits || []).length + (data.payments || []).length,
      });
      setMessage('The print/PDF action was recorded. Choose “Save as PDF” in the browser print window.');
      setTimeout(() => window.print(), 50);
    } catch (err) { setError(err?.message || 'Printing was blocked because the export could not be recorded.'); }
    finally { setBusy(false); }
  }

  async function confirmRestore() {
    if (!restoreTarget || restoreReason.trim().length < 3) return setError('Enter a clear restoration reason.');
    setBusy(true); setError(''); setMessage('');
    try {
      await restoreArchivedPatient(restoreTarget.record_id, restoreReason.trim());
      setRestoreTarget(null); setRestoreReason('');
      await refreshArchives();
      await onChanged?.();
      setMessage('Patient restored and the action was added to the audit history.');
    } catch (err) { setError(err?.message || 'Unable to restore the patient.'); }
    finally { setBusy(false); }
  }

  const exportCards = [
    ['patients', 'Patient directory', 'Complete clinic patient list'],
    ['appointments', 'Appointments', 'Selected month schedule and outcomes'],
    ['clinical', 'Clinical visits', 'Visit, diagnosis and doctor details'],
    ['payments', 'Payments', 'Collections, refunds and payment status'],
    ['invoices', 'Invoices and dues', 'Billed, paid and outstanding amounts'],
    ['staff_activity', 'Staff directory', 'Roles and clinic access status'],
  ];

  return <div className="report-admin">
    <div className="admin-section-title"><div><h2>Reports, exports and audit</h2><p>{monthName(month)} · owner-controlled reporting for {clinic.name}</p></div><div className="report-actions"><button className="admin-secondary" disabled={busy} onClick={exportFullWorkbook}>Download Excel workbook</button><button className="admin-primary" disabled={busy} onClick={printReport}>Print / Save PDF</button></div></div>
    {error ? <div className="admin-error" role="alert">{error}</div> : null}
    {message ? <div className="report-success" role="status">{message}</div> : null}
    <div className="report-tabs">
      {[['summary', 'Monthly summary'], ['exports', 'Data exports'], ['audit', 'Unified audit'], ['archived', 'Archived records']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
    </div>

    {tab === 'summary' ? <section className="report-print-root">
      <header className="report-print-header"><div><strong>CapDent Clinic Report</strong><h1>{clinic.name}</h1><p>{clinic.address || ''}</p></div><div><strong>{monthName(month)}</strong><p>Generated by {profile.name}</p><p>{dateTime(new Date())}</p></div></header>
      <section className="report-kpis">
        {[
          ['New patients', metrics.newPatients || 0], ['Appointments', metrics.appointments || 0], ['Completed visits', metrics.visits || 0],
          ['Net billed', money(metrics.billed, currency)], ['Payments received', money(positivePayments, currency)], ['Refunds', money(refunds, currency)],
          ['Net collection', money(metrics.collected, currency)], ['Outstanding dues', money(metrics.outstanding, currency)],
        ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </section>
      <div className="report-grid"><section className="admin-panel"><div className="admin-panel-head"><div><h3>Weekly activity</h3><p>Month split into operational weeks</p></div></div><DataTable headers={['Week', 'New patients', 'Appointments', 'Visits', `Net collected (${currency})`]} rows={weeklyRows.map((row) => [...row.slice(0, 4), money(row[4], currency)])} /></section><section className="admin-panel"><div className="admin-panel-head"><div><h3>Appointment outcomes</h3><p>Patient-flow status</p></div></div><DataTable headers={['Status', 'Count']} rows={['scheduled', 'waiting', 'completed', 'cancelled', 'no_show'].map((status) => [titleCase(status), (data.appointments || []).filter((row) => row.status === status || (status === 'cancelled' && row.status === 'canceled')).length])} /></section></div>
      <div className="report-grid"><section className="admin-panel"><div className="admin-panel-head"><div><h3>Treatment distribution</h3><p>Top procedures</p></div></div><DataTable headers={['Treatment', 'Count']} rows={treatmentSummary.slice(0, 12)} empty="No treatments recorded for this month." /></section><section className="admin-panel"><div className="admin-panel-head"><div><h3>Highest outstanding balances</h3><p>Priority dues follow-up</p></div></div><DataTable headers={['Patient', 'Total', 'Paid', 'Due']} rows={(data.invoices || []).filter((row) => Number(row.due_amount || 0) > 0).sort((a, b) => Number(b.due_amount) - Number(a.due_amount)).slice(0, 10).map((row) => [row.patient?.name || 'Unknown', money(row.total_amount, currency), money(row.paid_amount, currency), money(row.due_amount, currency)])} empty="No outstanding invoices." /></section></div>
      <footer className="report-print-footer"><span>CapDent administrative report</span><span>Confidential clinic information</span></footer>
    </section> : null}

    {tab === 'exports' ? <section className="report-export-grid">
      <article className="report-export-card featured"><div><span>Complete workbook</span><h3>Monthly clinic workbook</h3><p>Summary, patients, appointments, visits, payments, invoices and staff in one Excel-compatible file.</p></div><button className="admin-primary" disabled={busy} onClick={exportFullWorkbook}>Download workbook</button></article>
      {exportCards.map(([key, title, note]) => <article className="report-export-card" key={key}><div><span>{datasets[key].rows.length} rows</span><h3>{title}</h3><p>{note}</p></div><div><button className="admin-secondary" disabled={busy} onClick={() => exportDataset(key, 'csv')}>CSV</button><button className="admin-secondary" disabled={busy} onClick={() => exportDataset(key, 'excel')}>Excel</button></div></article>)}
    </section> : null}

    {tab === 'audit' ? <section className="admin-panel">
      <div className="report-filter-bar"><label>From<input type="date" value={auditStart} onChange={(event) => setAuditStart(event.target.value)} /></label><label>To<input type="date" value={auditEnd} onChange={(event) => setAuditEnd(event.target.value)} /></label><label>Source<select value={auditSource} onChange={(event) => setAuditSource(event.target.value)}><option value="">All sources</option><option value="patient">Patient</option><option value="appointment">Appointment</option><option value="clinical">Clinical</option><option value="financial">Financial</option><option value="management">Management</option><option value="report">Report exports</option></select></label><label className="report-search">Search<input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Patient, actor, reason, field…" /></label><button className="admin-primary" disabled={busy} onClick={refreshAudit}>{busy ? 'Loading…' : 'Search audit'}</button><button className="admin-secondary" disabled={busy || !auditRows.length} onClick={() => exportDataset('audit', 'csv')}>Export CSV</button></div>
      <DataTable headers={['Date', 'Source', 'Subject', 'Actor', 'Action', 'Field', 'Change / amount', 'Reason']} rows={auditRows.map((row) => [dateTime(row.created_at), titleCase(row.source), row.subject_name || '—', row.actor_name || '—', titleCase(row.action), titleCase(row.field_name), row.amount !== null ? money(row.amount, currency) : `${row.old_value || '—'} → ${row.new_value || '—'}`, row.reason || '—'])} empty={busy ? 'Loading audit history…' : 'No audit entries match these filters.'} />
    </section> : null}

    {tab === 'archived' ? <section className="admin-panel">
      <div className="report-filter-bar"><label>Record type<select value={archiveType} onChange={(event) => setArchiveType(event.target.value)}><option value="">All archived records</option><option value="patient">Patients</option><option value="appointment">Cancelled/no-show appointments</option><option value="payment">Voided payments</option><option value="staff">Inactive staff</option><option value="staff_invite">Cancelled invitations</option></select></label><button className="admin-primary" disabled={busy} onClick={refreshArchives}>Refresh</button><button className="admin-secondary" disabled={busy || !archivedRows.length} onClick={() => exportDataset('archived_records', 'csv')}>Export CSV</button></div>
      <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Type</th><th>Subject</th><th>Status</th><th>Date</th><th>Reason</th><th>Changed by</th><th>Action</th></tr></thead><tbody>{filteredArchives.map((row) => <tr key={`${row.record_type}-${row.record_id}`}><td>{titleCase(row.record_type)}</td><td>{row.subject_name || '—'}</td><td><span className="report-status">{titleCase(row.status)}</span></td><td>{dateTime(row.occurred_at)}</td><td>{row.reason || '—'}</td><td>{row.actor_name || '—'}</td><td>{row.record_type === 'patient' ? <button className="admin-secondary" onClick={() => { setRestoreTarget(row); setRestoreReason(''); }}>Restore patient</button> : <span className="report-muted">Manage in its module</span>}</td></tr>)}{!filteredArchives.length ? <tr><td colSpan="7"><div className="admin-empty">No archived records match this filter.</div></td></tr> : null}</tbody></table></div>
    </section> : null}

    {restoreTarget ? <div className="report-modal-backdrop" role="presentation"><section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="restore-title"><h3 id="restore-title">Restore {restoreTarget.subject_name}</h3><p>This returns the patient to the active directory. Existing visits, payments and history are not changed.</p><label>Restoration reason<textarea value={restoreReason} onChange={(event) => setRestoreReason(event.target.value)} placeholder="Why is this patient being restored?" /></label><div><button className="admin-secondary" disabled={busy} onClick={() => setRestoreTarget(null)}>Cancel</button><button className="admin-primary" disabled={busy || restoreReason.trim().length < 3} onClick={confirmRestore}>Restore patient</button></div></section></div> : null}
  </div>;
}
