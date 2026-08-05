import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './admin.css';
import PatientAdmin from './patient-admin';
import AppointmentAdmin from './appointment-admin';
import ClinicalAdmin from './clinical-admin';
import { loadAdminContext, loadAdminMonth, signInAdmin, supabase } from './admin-supabase';

const NAV = [
  ['dashboard', 'Dashboard', '⌂'], ['patients', 'Patients', '👥'], ['appointments', 'Appointments', '▣'],
  ['clinical', 'Visits & treatments', '🦷'], ['finance', 'Payments & invoices', '₹'], ['staff', 'Doctors & staff', '♟'],
  ['reports', 'Reports & exports', '⇩'], ['audit', 'Audit & archived', '↺'], ['settings', 'Clinic settings', '⚙'],
];
const EMPTY = { patients: [], monthPatients: [], appointments: [], visits: [], treatments: [], payments: [], invoices: [], staff: [], metrics: {} };
const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const monthLabel = (date) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date);
const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CD';
const change = (current, previous) => previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0;

function Login({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (!email.trim() || !password) return setError('Enter your CapDent account email and password.');
    setLoading(true); setError('');
    try { const result = await signInAdmin(email, password); await onSignedIn(result.session); }
    catch (err) { setError((err?.message || '').toLowerCase().includes('invalid login') ? 'Incorrect email or password.' : err?.message || 'Unable to sign in.'); }
    finally { setLoading(false); }
  }
  return <main className="admin-login"><section className="admin-card admin-login-card"><div className="admin-brand"><span className="admin-brand-mark">CD</span><div><strong>CapDent</strong><small>Clinic Admin</small></div></div><h1>Owner administration</h1><p>Manage clinic records, appointments, clinical history, finances, staff and monthly performance.</p><form onSubmit={submit}><label>Account email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error ? <div className="admin-error" role="alert">{error}</div> : null}<button disabled={loading}>{loading ? 'Opening admin panel…' : 'Sign in as owner / head doctor'}</button></form></section></main>;
}

function Table({ headers, rows }) {
  if (!rows.length) return <div className="admin-empty">No records found for this period.</div>;
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function Bars({ items }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className="admin-bars">{items.map((item) => <div className="admin-bar-row" key={item.label}><span>{item.label}</span><div className="admin-bar-track"><span style={{ width: `${item.value / max * 100}%` }} /></div><strong>{item.value}</strong></div>)}</div>;
}

function Donut({ items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const colours = ['#087f72', '#2f6f89', '#c58a22', '#8b6cb8', '#d05b4c', '#7e9498'];
  let cursor = 0;
  const stops = items.map((item, index) => { const start = cursor; cursor += total ? item.value / total * 100 : 0; return `${colours[index % colours.length]} ${start}% ${cursor}%`; }).join(',');
  return <div className="admin-donut-wrap"><div className="admin-donut" style={{ background: total ? `conic-gradient(${stops})` : '#e8efed' }} /><div className="admin-legend">{items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div>;
}

function Line({ rows, month, currency }) {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const values = Array.from({ length: days }, (_, index) => rows.filter((row) => new Date(row.created_at).getDate() === index + 1).reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const width = 700, height = 240, pad = 24, max = Math.max(...values, 1);
  const points = values.map((value, index) => ({ x: pad + index * (width - pad * 2) / Math.max(days - 1, 1), y: height - pad - value / max * (height - pad * 2) }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${path} L ${points.at(-1).x} ${height - pad} L ${points[0].x} ${height - pad} Z`;
  return <><svg className="admin-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily collections ${money(values.reduce((a, b) => a + b, 0), currency)}`}><line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className="admin-chart-grid" /><line x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} className="admin-chart-grid" /><path d={area} className="admin-chart-area" /><path d={path} className="admin-chart-line" /></svg><div className="admin-chart-labels"><span>1</span><span>{Math.ceil(days / 2)}</span><span>{days}</span></div></>;
}

function Dashboard({ data, clinic, month, setMonth }) {
  const metrics = data.metrics;
  const treatments = Object.entries(data.treatments.reduce((result, row) => { const key = row.treatment_name || 'Other'; result[key] = (result[key] || 0) + 1; return result; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));
  const methods = Object.entries(data.payments.reduce((result, row) => { const key = row.payment_method || 'Other'; result[key] = (result[key] || 0) + Number(row.amount || 0); return result; }, {})).map(([label, value]) => ({ label, value: Math.round(value) }));
  const outcomes = ['scheduled', 'waiting', 'completed', 'cancelled', 'no_show'].map((status) => ({ label: status.replaceAll('_', ' '), value: data.appointments.filter((row) => row.status === status || (status === 'cancelled' && row.status === 'canceled')).length }));
  const kpis = [
    ['Total patients', metrics.totalPatients, `${metrics.newPatients} added this month`], ['New patients', metrics.newPatients, `${change(metrics.newPatients, metrics.previousNewPatients)}% vs previous month`],
    ['Completed visits', metrics.visits, `${change(metrics.visits, metrics.previousVisits)}% vs previous month`], ['Appointments', metrics.appointments, `${metrics.cancelled} cancelled · ${metrics.noShows} no-show`],
    ['Amount billed', money(metrics.billed, clinic.currency_code), 'Gross invoice value'], ['Amount collected', money(metrics.collected, clinic.currency_code), `${change(metrics.collected, metrics.previousCollected)}% vs previous month`],
    ['Outstanding dues', money(metrics.outstanding, clinic.currency_code), `${data.invoices.filter((row) => Number(row.due_amount || 0) > 0).length} invoices`], ['Collection rate', `${metrics.collectionRate || 0}%`, `Average visit ${money(metrics.averageVisitValue, clinic.currency_code)}`],
  ];
  const shift = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  return <><section className="admin-period"><div><strong>{monthLabel(month)}</strong><small>Monthly owner report and clinic controls</small></div><div className="admin-month-controls"><button onClick={() => shift(-1)}>←</button><input type="month" value={`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`} max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`} onChange={(event) => { const [year, selectedMonth] = event.target.value.split('-').map(Number); setMonth(new Date(year, selectedMonth - 1, 1)); }} /><button onClick={() => shift(1)} disabled={month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth()}>→</button></div></section><section className="admin-kpis">{kpis.map(([label, value, note]) => <article className="admin-kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</section><div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><div><h2>Daily collections</h2><p>{monthLabel(month)}</p></div><strong>{money(metrics.collected, clinic.currency_code)}</strong></div><Line rows={data.payments} month={month} currency={clinic.currency_code} /></section><section className="admin-panel"><div className="admin-panel-head"><div><h2>Treatment distribution</h2><p>Top procedures</p></div></div>{treatments.length ? <Donut items={treatments} /> : <div className="admin-empty">No treatments this month.</div>}</section></div><div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><div><h2>Appointment outcomes</h2><p>Monthly patient flow</p></div></div><Bars items={outcomes} /></section><section className="admin-panel"><div className="admin-panel-head"><div><h2>Payment methods</h2><p>Monthly collection mix</p></div></div>{methods.length ? <Donut items={methods} /> : <div className="admin-empty">No payments this month.</div>}</section></div><div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><div><h2>Outstanding balances</h2><p>Highest pending invoices</p></div></div><Table headers={['Patient', 'Total', 'Paid', 'Due', 'Status']} rows={data.invoices.filter((row) => Number(row.due_amount || 0) > 0).sort((a, b) => Number(b.due_amount) - Number(a.due_amount)).slice(0, 8).map((row) => [row.patient?.name || 'Unknown', money(row.total_amount, clinic.currency_code), money(row.paid_amount, clinic.currency_code), money(row.due_amount, clinic.currency_code), row.status])} /></section><section className="admin-panel"><div className="admin-panel-head"><div><h2>Administrative safety</h2><p>Audit-controlled workflows</p></div></div><div className="admin-finance-note"><strong>Patient, appointment and clinical modifications are audited.</strong><br />Payment corrections, discounts, refunds and waivers remain disabled until the financial adjustment ledger is added.</div></section></div></>;
}

function Section({ section, data, clinic, profile, month, onRefresh }) {
  if (section === 'patients') return <PatientAdmin patients={data.patients} profile={profile} onChanged={onRefresh} />;
  if (section === 'appointments') return <AppointmentAdmin profile={profile} monthStart={data.period?.start} monthEnd={data.period?.end} onChanged={onRefresh} />;
  if (section === 'clinical') return <ClinicalAdmin profile={profile} monthStart={data.period?.start} monthEnd={data.period?.end} currency={clinic.currency_code} onChanged={onRefresh} />;
  if (section === 'finance') return <><div className="admin-section-title"><h2>Payments and invoices</h2><p>Corrections, discounts, refunds, voids and waivers will use a dedicated ledger.</p></div><section className="admin-panel"><div className="admin-finance-note">Financial modification controls remain disabled until every adjustment can be reversed and audited.</div><Table headers={['Date', 'Patient', 'Amount', 'Method', 'Category']} rows={data.payments.map((row) => [dateLabel(row.created_at), row.patient?.name || 'Unknown', money(row.amount, clinic.currency_code), row.payment_method || 'Other', row.payment_category || 'Other'])} /></section></>;
  if (section === 'staff') return <><div className="admin-section-title"><h2>Doctors and staff</h2><p>Clinic access and role management.</p></div><section className="admin-panel"><Table headers={['Name', 'Email', 'Role', 'Status']} rows={data.staff.map((row) => [row.name, row.email || '—', row.role, row.active ? 'Active' : 'Inactive'])} /></section></>;
  if (section === 'reports') return <><div className="admin-section-title"><h2>Reports and exports</h2><p>Monthly clinic reports will be added next.</p></div><section className="admin-panel"><div className="admin-empty">PDF, Excel and CSV export workflows are planned.</div></section></>;
  if (section === 'audit') return <><div className="admin-section-title"><h2>Audit and archived records</h2><p>Patient, appointment and clinical changes are recorded with reasons and timestamps.</p></div><section className="admin-panel"><div className="admin-finance-note">Open a patient, appointment or visit record to review field-by-field changes and append-only dental-chart corrections.</div></section></>;
  return <><div className="admin-section-title"><h2>Clinic settings</h2><p>Clinic identity and administrative preferences.</p></div><section className="admin-panel"><Table headers={['Field', 'Value']} rows={[["Clinic name", clinic.name], ["Phone", clinic.phone || '—'], ["Email", clinic.email || '—'], ["Address", clinic.address || '—']]} /></section></>;
}

function App() {
  const [phase, setPhase] = useState('checking');
  const [profile, setProfile] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [data, setData] = useState(EMPTY);
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [section, setSection] = useState('dashboard');
  const [error, setError] = useState('');

  async function loadMonth(currentProfile = profile, currentMonth = month) {
    if (!currentProfile) return;
    const rows = await loadAdminMonth(currentProfile, currentMonth);
    setData(rows);
  }
  async function open(nextSession) {
    if (!nextSession?.user) { setPhase('signed-out'); setProfile(null); setClinic(null); return; }
    setPhase('loading'); setError('');
    try { const context = await loadAdminContext(nextSession.user.id); setProfile(context.profile); setClinic(context.clinic); await loadMonth(context.profile, month); setPhase('ready'); }
    catch (err) { setError(err?.message || 'Unable to open Clinic Admin.'); setPhase('error'); }
  }
  useEffect(() => { let active = true; supabase.auth.getSession().then(({ data: auth }) => active && open(auth.session)); const { data: listener } = supabase.auth.onAuthStateChange((event, next) => { if (!active) return; if (event === 'SIGNED_OUT') setTimeout(() => open(null), 0); if (event === 'SIGNED_IN') setTimeout(() => open(next), 0); }); return () => { active = false; listener.subscription.unsubscribe(); }; }, []);
  useEffect(() => { if (!profile) return; setPhase('loading'); loadMonth(profile, month).then(() => setPhase('ready')).catch((err) => { setError(err?.message || 'Unable to load this month.'); setPhase('error'); }); }, [month]);
  async function refresh() { setPhase('loading'); try { await loadMonth(); setPhase('ready'); } catch (err) { setError(err.message); setPhase('error'); } }
  async function signOut() { await supabase.auth.signOut(); }

  if (phase === 'checking' || phase === 'loading') return <main className="admin-loading"><section className="admin-card admin-login-card"><h1>CapDent Clinic Admin</h1><p>Loading secure clinic analytics…</p></section></main>;
  if (phase === 'signed-out') return <Login onSignedIn={open} />;
  if (phase === 'error') return <main className="admin-loading"><section className="admin-card admin-access-denied"><h1>Admin access needs attention</h1><p>{error}</p><button className="admin-primary" onClick={signOut}>Return to sign in</button></section></main>;

  return <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand"><span className="admin-brand-mark">CD</span><div><strong>CapDent</strong><small>Clinic Admin</small></div></div><div className="admin-clinic"><strong>{clinic.name}</strong><small>Owner-controlled database</small></div><nav className="admin-nav"><p>Administration</p>{NAV.map(([key, label, icon]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}><span>{icon}</span>{label}</button>)}</nav><div className="admin-sidebar-footer"><button onClick={signOut}>Sign out</button></div></aside><div className="admin-workspace"><header className="admin-topbar"><div><h1>{section === 'dashboard' ? 'Clinic performance' : NAV.find(([key]) => key === section)?.[1]}</h1><p>Owner and head-doctor administration panel</p></div><div className="admin-user"><span className="admin-avatar">{initials(profile.name)}</span><div><strong>{profile.name}</strong><small>Owner / Head doctor</small></div></div></header><main className="admin-content">{section === 'dashboard' ? <Dashboard data={data} clinic={clinic} month={month} setMonth={setMonth} /> : <Section section={section} data={data} clinic={clinic} profile={profile} month={month} onRefresh={refresh} />}</main></div></div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
