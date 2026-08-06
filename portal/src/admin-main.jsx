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
import { loadAdminContext, loadAdminPeriod, signInAdmin, supabase } from './admin-supabase';
import {
  PERIOD_MODES,
  isCurrentOrFuturePeriod,
  parsePeriodInput,
  periodBounds,
  periodInputValue,
  periodNoun,
  shiftPeriod,
} from './admin-period';

const NAV = [
  ['dashboard', 'Dashboard', '⌂'], ['patients', 'Patients', '👥'], ['appointments', 'Appointments', '▣'],
  ['clinical', 'Visits & treatments', '🦷'], ['gallery', 'Gallery', '▧'], ['finance', 'Payments & invoices', '₹'],
  ['staff', 'Doctors & staff', '♟'], ['reports', 'Reports & exports', '⇩'],
  ['audit', 'Audit & archived', '↺'], ['settings', 'Clinic settings', '⚙'],
];
const EMPTY = { patients: [], periodPatients: [], appointments: [], visits: [], treatments: [], payments: [], invoices: [], allInvoices: [], files: [], staff: [], metrics: {} };
const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
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
  return <main className="admin-login"><section className="admin-card admin-login-card"><div className="admin-brand"><span className="admin-brand-mark">CD</span><div><strong>CapDent</strong><small>Clinic Admin</small></div></div><h1>Owner administration</h1><p>Review daily, weekly or monthly patients, appointments, clinical work, gallery files, finances and staff activity.</p><form onSubmit={submit}><label>Account email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error ? <div className="admin-error" role="alert">{error}</div> : null}<button disabled={loading}>{loading ? 'Opening admin panel…' : 'Sign in as owner / head doctor'}</button></form></section></main>;
}

function Table({ headers, rows }) {
  if (!rows.length) return <div className="admin-empty">No records found for this period.</div>;
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function PeriodSelector({ mode, anchor, period, onMode, onAnchor }) {
  const shift = (direction) => onAnchor(shiftPeriod(mode, anchor, direction));
  return <section className="admin-global-period" aria-label="Owner reporting period">
    <div className="admin-period-copy"><span>Viewing</span><strong>{period.label}</strong><small>All period-sensitive sections follow this selection.</small></div>
    <div className="admin-period-segments" role="group" aria-label="Reporting frequency">
      {PERIOD_MODES.map((item) => <button key={item.key} className={mode === item.key ? 'active' : ''} onClick={() => onMode(item.key)}>{item.label}</button>)}
    </div>
    <div className="admin-period-navigation">
      <button onClick={() => shift(-1)} aria-label={`Show previous ${periodNoun(mode)}`}>←</button>
      <input
        type={mode === 'monthly' ? 'month' : 'date'}
        aria-label={`Select ${periodNoun(mode)}`}
        value={periodInputValue(mode, anchor)}
        max={periodInputValue(mode, new Date())}
        onChange={(event) => onAnchor(parsePeriodInput(mode, event.target.value))}
      />
      <button onClick={() => shift(1)} aria-label={`Show next ${periodNoun(mode)}`} disabled={isCurrentOrFuturePeriod(mode, anchor)}>→</button>
      <button className="today" onClick={() => onAnchor(new Date())}>Current</button>
    </div>
  </section>;
}

function CollectionChart({ payments, period, currency }) {
  const start = new Date(period.start);
  let labels = [];
  let values = [];

  if (period.mode === 'daily') {
    labels = Array.from({ length: 24 }, (_, hour) => hour);
    values = labels.map((hour) => payments.filter((row) => new Date(row.created_at).getHours() === hour).reduce((sum, row) => sum + Number(row.amount || 0), 0));
  } else if (period.mode === 'weekly') {
    labels = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start); date.setDate(start.getDate() + index); return date;
    });
    values = labels.map((date) => payments.filter((row) => {
      const item = new Date(row.created_at);
      return item.getFullYear() === date.getFullYear() && item.getMonth() === date.getMonth() && item.getDate() === date.getDate();
    }).reduce((sum, row) => sum + Number(row.amount || 0), 0));
  } else {
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    labels = Array.from({ length: days }, (_, index) => index + 1);
    values = labels.map((day) => payments.filter((row) => new Date(row.created_at).getDate() === day).reduce((sum, row) => sum + Number(row.amount || 0), 0));
  }

  const width = 720, height = 240, pad = 24;
  const max = Math.max(...values, 0), min = Math.min(...values, 0), range = Math.max(max - min, 1);
  const y = (value) => pad + ((max - value) / range) * (height - pad * 2);
  const points = values.map((value, index) => ({ x: pad + index * (width - pad * 2) / Math.max(values.length - 1, 1), y: y(value) }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const zero = y(0);
  const firstLabel = period.mode === 'daily' ? '12 AM' : period.mode === 'weekly' ? new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(labels[0]) : '1';
  const middleLabel = period.mode === 'daily' ? '12 PM' : period.mode === 'weekly' ? new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(labels[3]) : String(Math.ceil(labels.length / 2));
  const lastLabel = period.mode === 'daily' ? '11 PM' : period.mode === 'weekly' ? new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(labels[6]) : String(labels.length);
  return <><svg className="admin-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Net collections ${money(values.reduce((sum, value) => sum + value, 0), currency)}`}><line x1={pad} x2={width - pad} y1={zero} y2={zero} className="admin-chart-grid" /><path d={`${path} L ${points.at(-1)?.x || pad} ${zero} L ${points[0]?.x || pad} ${zero} Z`} className="admin-chart-area" /><path d={path} className="admin-chart-line" /></svg><div className="admin-chart-labels"><span>{firstLabel}</span><span>{middleLabel}</span><span>{lastLabel}</span></div></>;
}

function Bars({ items }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className="admin-bars">{items.map((item) => <div className="admin-bar-row" key={item.label}><span>{item.label}</span><div className="admin-bar-track"><span style={{ width: `${item.value / max * 100}%` }} /></div><strong>{item.value}</strong></div>)}</div>;
}

function Dashboard({ data, clinic }) {
  const metrics = data.metrics || {};
  const period = data.period || periodBounds('monthly', new Date());
  const noun = periodNoun(period.mode);
  const treatments = useMemo(() => Object.entries((data.treatments || []).reduce((result, row) => { const key = row.treatment_name || 'Other'; result[key] = (result[key] || 0) + 1; return result; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })), [data.treatments]);
  const outcomes = ['scheduled', 'waiting', 'completed', 'cancelled', 'no_show'].map((status) => ({ label: status.replaceAll('_', ' '), value: (data.appointments || []).filter((row) => row.status === status || (status === 'cancelled' && row.status === 'canceled')).length }));
  const kpis = [
    ['Total active patients', metrics.totalPatients || 0, `${metrics.newPatients || 0} added this ${noun}`],
    ['New patients', metrics.newPatients || 0, `${percentChange(metrics.newPatients || 0, metrics.previousNewPatients || 0)}% vs previous ${noun}`],
    ['Completed visits', metrics.visits || 0, `${percentChange(metrics.visits || 0, metrics.previousVisits || 0)}% vs previous ${noun}`],
    ['Appointments', metrics.appointments || 0, `${metrics.cancelled || 0} cancelled · ${metrics.noShows || 0} no-show`],
    ['Gallery uploads', metrics.galleryFiles || 0, `${percentChange(metrics.galleryFiles || 0, metrics.previousGalleryFiles || 0)}% vs previous ${noun}`],
    ['Amount billed', money(metrics.billed, clinic.currency_code), `Invoices created this ${noun}`],
    ['Net collection', money(metrics.collected, clinic.currency_code), `${percentChange(metrics.collected || 0, metrics.previousCollected || 0)}% vs previous ${noun}`],
    ['Outstanding dues', money(metrics.outstanding, clinic.currency_code), `${(data.allInvoices || []).filter((row) => Number(row.due_amount || 0) > 0).length} lifetime invoices`],
    ['Collection rate', `${metrics.collectionRate || 0}%`, `Average visit ${money(metrics.averageVisitValue, clinic.currency_code)}`],
  ];
  return <>
    <section className="admin-kpis">{kpis.map(([label, value, note]) => <article className="admin-kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</section>
    <div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><div><h2>Net collections</h2><p>{period.label} · refunds appear below zero</p></div><strong>{money(metrics.collected, clinic.currency_code)}</strong></div><CollectionChart payments={data.payments || []} period={period} currency={clinic.currency_code} /></section><section className="admin-panel"><div className="admin-panel-head"><div><h2>Treatment distribution</h2><p>Top procedures in the selected {noun}</p></div></div><Bars items={treatments.length ? treatments : [{ label: 'No treatments', value: 0 }]} /></section></div>
    <div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><div><h2>Appointment outcomes</h2><p>Patient flow for {period.label}</p></div></div><Bars items={outcomes} /></section><section className="admin-panel"><div className="admin-panel-head"><div><h2>Administrative safety</h2><p>Owner-controlled and audited</p></div></div><div className="admin-finance-note"><strong>Patient, appointment, clinical, gallery, financial, staff and clinic-setting changes are audited.</strong><br />Dental charts remain append-only, gallery files are recoverably archived, invoice versions preserve financial history, and staff deactivation disables active push tokens.</div></section></div>
    <section className="admin-panel" style={{ marginTop: 16 }}><div className="admin-panel-head"><div><h2>Outstanding balances</h2><p>Lifetime dues as of the end of {period.label}</p></div></div><Table headers={['Patient', 'Total', 'Paid', 'Due', 'Status']} rows={(data.allInvoices || []).filter((row) => Number(row.due_amount || 0) > 0).sort((a, b) => Number(b.due_amount) - Number(a.due_amount)).slice(0, 10).map((row) => [row.patient?.name || 'Unknown', money(row.total_amount, clinic.currency_code), money(row.paid_amount, clinic.currency_code), money(row.due_amount, clinic.currency_code), row.status])} /></section>
  </>;
}

function Section({ section, data, clinic, profile, anchor, onRefresh }) {
  const period = data.period;
  if (section === 'patients') return <PatientAdmin patients={data.patients || []} profile={profile} periodStart={period?.start} periodEnd={period?.end} periodLabel={period?.label} onChanged={onRefresh} />;
  if (section === 'appointments') return <AppointmentAdmin profile={profile} monthStart={period?.start} monthEnd={period?.end} onChanged={onRefresh} />;
  if (section === 'clinical') return <ClinicalAdmin profile={profile} monthStart={period?.start} monthEnd={period?.end} currency={clinic.currency_code} onChanged={onRefresh} />;
  if (section === 'gallery') return <GalleryAdmin profile={profile} periodStart={period?.start} periodEnd={period?.end} periodLabel={period?.label} onChanged={onRefresh} />;
  if (section === 'finance') return <FinanceAdmin profile={profile} monthStart={period?.start} monthEnd={period?.end} currency={clinic.currency_code} onChanged={onRefresh} />;
  if (section === 'staff') return <ManagementAdmin profile={profile} clinic={clinic} periodStart={period?.start} periodEnd={period?.end} periodLabel={period?.label} mode="staff" onChanged={onRefresh} />;
  if (section === 'settings') return <ManagementAdmin profile={profile} clinic={clinic} periodStart={period?.start} periodEnd={period?.end} periodLabel={period?.label} mode="settings" onChanged={onRefresh} />;
  if (section === 'reports') return <ReportAdmin key={`reports-${period?.start}`} data={data} clinic={clinic} profile={profile} anchor={anchor} initialTab="summary" onChanged={onRefresh} />;
  return <ReportAdmin key={`audit-${period?.start}`} data={data} clinic={clinic} profile={profile} anchor={anchor} initialTab="audit" onChanged={onRefresh} />;
}

function App() {
  const [phase, setPhase] = useState('checking');
  const [profile, setProfile] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [data, setData] = useState(EMPTY);
  const [periodMode, setPeriodMode] = useState('monthly');
  const [anchor, setAnchor] = useState(new Date());
  const [section, setSection] = useState('dashboard');
  const [error, setError] = useState('');
  const selectedPeriod = useMemo(() => periodBounds(periodMode, anchor), [periodMode, anchor]);

  async function loadPeriod(currentProfile = profile, currentAnchor = anchor, currentMode = periodMode) {
    if (!currentProfile) return EMPTY;
    const rows = await loadAdminPeriod(currentProfile, currentAnchor, currentMode);
    setData(rows);
    return rows;
  }

  async function open(nextSession) {
    if (!nextSession?.user) { setPhase('signed-out'); setProfile(null); setClinic(null); setData(EMPTY); return; }
    setPhase('loading'); setError('');
    try {
      const context = await loadAdminContext(nextSession.user.id);
      setProfile(context.profile); setClinic(context.clinic);
      await loadPeriod(context.profile, anchor, periodMode);
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
    loadPeriod(profile, anchor, periodMode).then(() => setPhase('ready')).catch((err) => { setError(err?.message || 'Unable to load this reporting period.'); setPhase('error'); });
  }, [anchor, periodMode]);

  async function refresh() {
    setError('');
    try {
      const context = await loadAdminContext(profile.id);
      setProfile(context.profile); setClinic(context.clinic);
      await loadPeriod(context.profile, anchor, periodMode);
      return context;
    } catch (err) { setError(err?.message || 'Unable to refresh Clinic Admin.'); throw err; }
  }
  async function signOut() { await supabase.auth.signOut(); }

  if (phase === 'checking' || phase === 'loading') return <main className="admin-loading"><section className="admin-card admin-login-card"><h1>CapDent Clinic Admin</h1><p>Loading secure clinic analytics…</p></section></main>;
  if (phase === 'signed-out') return <Login onSignedIn={open} />;
  if (phase === 'error') return <main className="admin-loading"><section className="admin-card admin-access-denied"><h1>Admin access needs attention</h1><p>{error}</p><button className="admin-primary" onClick={signOut}>Return to sign in</button></section></main>;

  const title = section === 'dashboard' ? 'Clinic performance' : NAV.find(([key]) => key === section)?.[1];
  return <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand"><span className="admin-brand-mark" style={{ background: clinic.brand_color || undefined }}>CD</span><div><strong>CapDent</strong><small>Clinic Admin</small></div></div><div className="admin-clinic"><strong>{clinic.name}</strong><small>Owner-controlled database</small></div><nav className="admin-nav"><p>Administration</p>{NAV.map(([key, label, icon]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}><span>{icon}</span>{label}</button>)}</nav><div className="admin-sidebar-footer"><button onClick={signOut}>Sign out</button></div></aside><div className="admin-workspace"><header className="admin-topbar"><div><h1>{title}</h1><p>{selectedPeriod.label} · Owner and head-doctor administration</p></div><div className="admin-user"><span className="admin-avatar">{initials(profile.name)}</span><div><strong>{profile.name}</strong><small>{profile.role === 'owner' ? 'Clinic owner' : 'Head doctor'}</small></div></div></header><main className="admin-content">{error ? <div className="admin-error" role="alert">{error}</div> : null}<PeriodSelector mode={periodMode} anchor={anchor} period={data.period || selectedPeriod} onMode={setPeriodMode} onAnchor={setAnchor} />{section === 'dashboard' ? <Dashboard data={data} clinic={clinic} /> : <Section section={section} data={data} clinic={clinic} profile={profile} anchor={anchor} onRefresh={refresh} />}</main></div></div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
