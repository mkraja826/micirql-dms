import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './admin.css';
import PatientAdmin from './patient-admin';
import AppointmentAdmin from './appointment-admin';
import ClinicalAdmin from './clinical-admin';
import GalleryAdmin from './gallery-admin';
import FinanceAdmin from './finance-admin';
import ManagementAdmin from './management-admin';
import ReportAdmin from './report-admin';
import { loadAdminContext, loadAdminMonth, signInAdmin, supabase } from './admin-supabase';

const NAV = [
  ['dashboard', 'Dashboard', '⌂'], ['patients', 'Patients', '👥'], ['appointments', 'Appointments', '▣'],
  ['clinical', 'Visits & treatments', '🦷'], ['gallery', 'Gallery', '▧'], ['finance', 'Payments & invoices', '₹'],
  ['staff', 'Doctors & staff', '♟'], ['reports', 'Reports & exports', '⇩'],
  ['audit', 'Audit & archived', '↺'], ['settings', 'Clinic settings', '⚙'],
];
const EMPTY = { patients: [], monthPatients: [], appointments: [], visits: [], treatments: [], payments: [], invoices: [], staff: [], metrics: {} };
const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const monthLabel = (date) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date);
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CD';
const percentChange = (current, previous) => previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0;

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
  return <main className="admin-login"><section className="admin-card admin-login-card"><div className="admin-brand"><span className="admin-brand-mark">CD</span><div><strong>CapDent</strong><small>Clinic Admin</small></div></div><h1>Owner administration</h1><p>Manage clinic records, appointments, clinical history, gallery files, finances, staff and monthly performance.</p><form onSubmit={submit}><label>Account email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error ? <div className="admin-error" role="alert">{error}</div> : null}<button disabled={loading}>{loading ? 'Opening admin panel…' : 'Sign in as owner / head doctor'}</button></form></section></main>;
}

function Table({ headers, rows }) {
  if (!rows.length) return <div className="admin-empty">No records found for this period.</div>;
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function LineChart({ payments, month, currency }) {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const values = Array.from({ length: days }, (_, index) => payments.filter((row) => new Date(row.created_at).getDate() === index + 1).reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const width = 720, height = 240, pad = 24;
  const max = Math.max(...values, 0), min = Math.min(...values, 0), range = Math.max(max - min, 1);
  const y = (value) => pad + ((max - value) / range) * (height - pad * 2);
  const points = values.map((value, index) => ({ x: pad + index * (width - pad * 2) / Math.max(days - 1, 1), y: y(value) }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const zero = y(0);
  return <><svg className="admin-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily net collections ${money(values.reduce((sum, value) => sum + value, 0), currency)}`}><line x1={pad} x2={width - pad} y1={zero} y2={zero} className="admin-chart-grid" /><path d={`${path} L ${points.at(-1)?.x || pad} ${zero} L ${points[0]?.x || pad} ${zero} Z`} className="admin-chart-area" /><path d={path} className="admin-chart-line" /></svg><div className="admin-chart-labels"><span>1</span><span>{Math.ceil(days / 2)}</span><span>{days}</span></div></>;
}

function Bars({ items }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className="admin-bars">{items.map((item) => <div className="admin-bar-row" key={item.label}><span>{item.label}</span><div className="admin-bar-track"><span style={{ width: `${item.value / max * 100}%` }} /></div><strong>{item.value}</strong></div>)}</div>;
}

function Dashboard({ data, clinic, month, setMonth }) {
  const metrics = data.metrics || {};
  const treatments = useMemo(() => Object.entries((data.treatments || []).reduce((result, row) => { const key = row.treatment_name || 'Other'; result[key] = (result[key] || 0) + 1; return result; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })), [data.treatments]);
  const outcomes = ['scheduled', 'waiting', 'completed', 'cancelled', 'no_show'].map((status) => ({ label: status.replaceAll('_', ' '), value: (data.appointments || []).filter((row) => row.status === status || (status === 'cancelled' && row.status === 'canceled')).length }));
  const kpis = [
    ['Total patients', metrics.totalPatients || 0, `${metrics.newPatients || 0} added this month`],
    ['New patients', metrics.newPatients || 0, `${percentChange(metrics.newPatients || 0, metrics.previousNewPatients || 0)}% vs previous month`],
    ['Completed visits', metrics.visits || 0, `${percentChange(metrics.visits || 0, metrics.previousVisits || 0)}% vs previous month`],
    ['Appointments', metrics.appointments || 0, `${metrics.cancelled || 0} cancelled · ${metrics.noShows || 0} no-show`],
    ['Amount billed', money(metrics.billed, clinic.currency_code), 'Current net invoice value'],
    ['Net collection', money(metrics.collected, clinic.currency_code), `${percentChange(metrics.collected || 0, metrics.previousCollected || 0)}% vs previous month`],
    ['Outstanding dues', money(metrics.outstanding, clinic.currency_code), `${(data.invoices || []).filter((row) => Number(row.due_amount || 0) > 0).length} invoices`],
    ['Collection rate', `${metrics.collectionRate || 0}%`, `Average visit ${money(metrics.averageVisitValue, clinic.currency_code)}`],
  ];
  const shift = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  return <>
    <section className="admin-period"><div><strong>{monthLabel(month)}</strong><small>Monthly owner report and clinic controls</small></div><div className="admin-month-controls"><button onClick={() => shift(-1)} aria-label="Show previous month">←</button><input type="month" aria-label="Select reporting month" value={`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`} max={new Date().toISOString().slice(0, 7)} onChange={(event) => { const [year, selectedMonth] = event.target.value.split('-').map(Number); setMonth(new Date(year, selectedMonth - 1, 1)); }} /><button onClick={() => shift(1)} aria-label="Show next month" disabled={month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth()}>→</button></div></section>
    <section className="admin-kpis">{kpis.map(([label, value, note]) => <article className="admin-kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</section>
    <div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><div><h2>Daily net collections</h2><p>Refunds appear below zero</p></div><strong>{money(metrics.collected, clinic.currency_code)}</strong></div><LineChart payments={data.payments || []} month={month} currency={clinic.currency_code} /></section><section className="admin-panel"><div className="admin-panel-head"><div><h2>Treatment distribution</h2><p>Top procedures this month</p></div></div><Bars items={treatments.length ? treatments : [{ label: 'No treatments', value: 0 }]} /></section></div>
    <div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><div><h2>Appointment outcomes</h2><p>Monthly patient flow</p></div></div><Bars items={outcomes} /></section><section className="admin-panel"><div className="admin-panel-head"><div><h2>Administrative safety</h2><p>Owner-controlled and audited</p></div></div><div className="admin-finance-note"><strong>Patient, appointment, clinical, gallery, financial, staff and clinic-setting changes are audited.</strong><br />Dental charts remain append-only, gallery files are recoverably archived, invoice versions preserve financial history, and staff deactivation disables active push tokens.</div></section></div>
    <section className="admin-panel" style={{ marginTop: 16 }}><div className="admin-panel-head"><div><h2>Outstanding balances</h2><p>Highest pending invoices</p></div></div><Table headers={['Patient', 'Total', 'Paid', 'Due', 'Status']} rows={(data.invoices || []).filter((row) => Number(row.due_amount || 0) > 0).sort((a, b) => Number(b.due_amount) - Number(a.due_amount)).slice(0, 10).map((row) => [row.patient?.name || 'Unknown', money(row.total_amount, clinic.currency_code), money(row.paid_amount, clinic.currency_code), money(row.due_amount, clinic.currency_code), row.status])} /></section>
  </>;
}

function Section({ section, data, clinic, profile, month, onRefresh }) {
  if (section === 'patients') return <PatientAdmin patients={data.patients || []} profile={profile} onChanged={onRefresh} />;
  if (section === 'appointments') return <AppointmentAdmin profile={profile} monthStart={data.period?.start} monthEnd={data.period?.end} onChanged={onRefresh} />;
  if (section === 'clinical') return <ClinicalAdmin profile={profile} monthStart={data.period?.start} monthEnd={data.period?.end} currency={clinic.currency_code} onChanged={onRefresh} />;
  if (section === 'gallery') return <GalleryAdmin profile={profile} onChanged={onRefresh} />;
  if (section === 'finance') return <FinanceAdmin profile={profile} monthStart={data.period?.start} monthEnd={data.period?.end} currency={clinic.currency_code} onChanged={onRefresh} />;
  if (section === 'staff') return <ManagementAdmin profile={profile} clinic={clinic} monthStart={data.period?.start} mode="staff" onChanged={onRefresh} />;
  if (section === 'settings') return <ManagementAdmin profile={profile} clinic={clinic} monthStart={data.period?.start} mode="settings" onChanged={onRefresh} />;
  if (section === 'reports') return <ReportAdmin key="reports" data={data} clinic={clinic} profile={profile} month={month} initialTab="summary" onChanged={onRefresh} />;
  return <ReportAdmin key="audit" data={data} clinic={clinic} profile={profile} month={month} initialTab="audit" onChanged={onRefresh} />;
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
    if (!currentProfile) return EMPTY;
    const rows = await loadAdminMonth(currentProfile, currentMonth);
    setData(rows);
    return rows;
  }

  async function open(nextSession) {
    if (!nextSession?.user) { setPhase('signed-out'); setProfile(null); setClinic(null); setData(EMPTY); return; }
    setPhase('loading'); setError('');
    try {
      const context = await loadAdminContext(nextSession.user.id);
      setProfile(context.profile); setClinic(context.clinic);
      await loadMonth(context.profile, month);
      setPhase('ready');
    } catch (err) { setError(err?.message || 'Unable to open Clinic Admin.'); setPhase('error'); }
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: auth }) => active && open(auth.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') setTimeout(() => open(null), 0);
      if (event === 'SIGNED_IN') setTimeout(() => open(next), 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!profile) return;
    setPhase('loading');
    loadMonth(profile, month).then(() => setPhase('ready')).catch((err) => { setError(err?.message || 'Unable to load this month.'); setPhase('error'); });
  }, [month]);

  async function refresh() {
    setError('');
    try {
      const context = await loadAdminContext(profile.id);
      setProfile(context.profile); setClinic(context.clinic);
      await loadMonth(context.profile, month);
      return context;
    } catch (err) { setError(err?.message || 'Unable to refresh Clinic Admin.'); throw err; }
  }
  async function signOut() { await supabase.auth.signOut(); }

  if (phase === 'checking' || phase === 'loading') return <main className="admin-loading"><section className="admin-card admin-login-card"><h1>CapDent Clinic Admin</h1><p>Loading secure clinic analytics…</p></section></main>;
  if (phase === 'signed-out') return <Login onSignedIn={open} />;
  if (phase === 'error') return <main className="admin-loading"><section className="admin-card admin-access-denied"><h1>Admin access needs attention</h1><p>{error}</p><button className="admin-primary" onClick={signOut}>Return to sign in</button></section></main>;

  return <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand"><span className="admin-brand-mark" style={{ background: clinic.brand_color || undefined }}>CD</span><div><strong>CapDent</strong><small>Clinic Admin</small></div></div><div className="admin-clinic"><strong>{clinic.name}</strong><small>Owner-controlled database</small></div><nav className="admin-nav"><p>Administration</p>{NAV.map(([key, label, icon]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}><span>{icon}</span>{label}</button>)}</nav><div className="admin-sidebar-footer"><button onClick={signOut}>Sign out</button></div></aside><div className="admin-workspace"><header className="admin-topbar"><div><h1>{section === 'dashboard' ? 'Clinic performance' : NAV.find(([key]) => key === section)?.[1]}</h1><p>Owner and head-doctor administration panel</p></div><div className="admin-user"><span className="admin-avatar">{initials(profile.name)}</span><div><strong>{profile.name}</strong><small>{profile.role === 'owner' ? 'Clinic owner' : 'Head doctor'}</small></div></div></header><main className="admin-content">{error ? <div className="admin-error" role="alert">{error}</div> : null}{section === 'dashboard' ? <Dashboard data={data} clinic={clinic} month={month} setMonth={setMonth} /> : <Section section={section} data={data} clinic={clinic} profile={profile} month={month} onRefresh={refresh} />}</main></div></div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
