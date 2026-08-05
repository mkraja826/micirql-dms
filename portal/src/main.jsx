import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './intelligence.css';
import './live.css';
import {
  createPortalPatient,
  isSupabaseConfigured,
  loadPortalContext,
  loadPortalData,
  signInToClinic,
  supabase,
  updatePortalClinic,
} from './supabase';

const NAV_ITEMS = [
  ['overview', 'Dashboard', '⌂'],
  ['patients', 'Patients', '👥'],
  ['appointments', 'Appointments', '▣'],
  ['billing', 'Payments & dues', '₹'],
  ['files', 'Clinical files', '▧'],
  ['visits', 'Treatments & visits', '🦷'],
  ['staff', 'Staff activity', '♟'],
  ['reports', 'Reports', '⇩'],
  ['settings', 'Clinic settings', '⚙'],
];

const SECTION_COPY = {
  overview: ['Clinic dashboard', 'Live patients, appointments, payments and clinic priorities.'],
  patients: ['Patient directory', 'Create and search patient records in your clinic.'],
  appointments: ['Appointments', 'Today’s live schedule and patient status.'],
  billing: ['Payments & dues', 'Collections and outstanding patient balances.'],
  files: ['Clinical files', 'Recent prescriptions, X-rays and clinical uploads.'],
  visits: ['Treatments & visits', 'Recent clinic visits and treatment activity.'],
  staff: ['Clinic staff', 'Authorised clinic accounts and roles.'],
  reports: ['Reports & backup', 'Download the clinic data currently visible to your account.'],
  settings: ['Clinic settings', 'Review or update your clinic information.'],
};

const EMPTY_DATA = {
  patientCount: 0,
  patients: [],
  appointments: [],
  payments: [],
  todayPayments: [],
  dueInvoices: [],
  recentVisits: [],
  visitsSeries: [],
  files: [],
  staff: [],
  treatments: [],
  metrics: {
    patientsToday: 0,
    newPatientsToday: 0,
    waitingNow: 0,
    completedToday: 0,
    bookedToday: 0,
    missedToday: 0,
    cancelledToday: 0,
    followupsToday: 0,
    collectedToday: 0,
    pendingTotal: 0,
  },
};

const money = (value, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const dateText = (value, options = {}) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...options,
      }).format(new Date(value))
    : '—';

const timeText = (value) =>
  value
    ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    : '—';

function roleLabel(role) {
  if (role === 'owner' || role === 'head_doctor') return 'Owner / Head doctor';
  if (role === 'doctor' || role === 'working_doctor') return 'Doctor';
  return 'Receptionist';
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CD';
}

function Logo({ large = false }) {
  return (
    <div className={large ? 'brand-mark large' : 'brand-mark'} aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <rect width="48" height="48" rx="13" fill="#087f72" />
        <path d="M24 10v28M13.5 16l21 16M34.5 16l-21 16" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Card({ title, subtitle, action, className = '', children }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Empty({ title, text }) {
  return <div className="live-empty"><strong>{title}</strong><p>{text}</p></div>;
}

function Status({ value }) {
  const normalized = String(value || 'unknown').toLowerCase();
  const tone = ['completed', 'done', 'active', 'paid'].includes(normalized)
    ? 'green'
    : ['waiting', 'checked_in', 'partial'].includes(normalized)
      ? 'amber'
      : 'blue';
  return <span className={`status ${tone}`}>{normalized.replaceAll('_', ' ')}</span>;
}

function PortalLoading({ text = 'Opening your clinic securely…' }) {
  return (
    <main className="portal-loading">
      <section className="portal-loading-card">
        <Logo large />
        <h1>CapDent Clinic Portal</h1>
        <p>{text}</p>
        <div className="portal-spinner" aria-label="Loading" />
      </section>
    </main>
  );
}

function PortalError({ message, onSignOut }) {
  return (
    <main className="portal-loading">
      <section className="portal-loading-card">
        <Logo large />
        <h1>Clinic access needs attention</h1>
        <p>{message}</p>
        <div className="portal-error-actions">
          <button type="button" onClick={onSignOut}>Return to sign in</button>
          <a href="mailto:support@micirql.com?subject=CapDent%20Clinic%20Portal%20Access">Contact support</a>
        </div>
      </section>
    </main>
  );
}

function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setMessage('Enter the email and password connected to your CapDent account.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const result = await signInToClinic(email, password);
      await onSignedIn(result.session);
    } catch (error) {
      const text = error?.message || 'Unable to sign in. Check your email and password.';
      setMessage(text.toLowerCase().includes('invalid login') ? 'Incorrect email or password.' : text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <a className="login-back" href="/">← Back to CapDent</a>
      <div className="login-layout">
        <section className="login-story" aria-labelledby="login-story-title">
          <div className="login-brand"><Logo /><div><strong>CapDent</strong><span>Clinic Portal</span></div></div>
          <div className="login-story-copy">
            <p className="login-overline">Live clinic workspace</p>
            <h1 id="login-story-title">Know what is happening. Know what needs attention.</h1>
            <p>Sign in with the same CapDent account used by your clinic team. Your portal is protected by clinic-level access policies.</p>
          </div>
          <div className="login-summary" aria-label="Clinic portal highlights">
            <div><span>Today</span><strong>Patients and waiting room</strong><small>Review current appointments, arrivals and completed work.</small></div>
            <div><span>Payments</span><strong>Collections and pending amounts</strong><small>See live payments and outstanding patient balances.</small></div>
            <div><span>Security</span><strong>Only your clinic data</strong><small>Supabase RLS keeps each clinic workspace isolated.</small></div>
          </div>
          <p className="login-story-note">Connected to the same CapDent backend used by the Android app.</p>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-panel-inner">
            <p className="login-kicker">Clinic Portal</p>
            <h2 id="login-title">Sign in to your clinic</h2>
            <p className="login-intro">Use your CapDent owner, doctor or receptionist account.</p>

            <form className="login-form" onSubmit={submit} noValidate>
              <label htmlFor="clinic-email">Account email<input id="clinic-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="doctor@clinic.com" required /></label>
              <label htmlFor="clinic-password">Password<div className="password-field"><input id="clinic-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
              {message ? <p className="login-error" role="alert">{message}</p> : null}
              <button className="login-submit" type="submit" disabled={loading || !isSupabaseConfigured}>{loading ? 'Signing in securely…' : 'Sign in to clinic'}</button>
            </form>

            {!isSupabaseConfigured ? <div className="login-config-error">The portal is missing its Supabase browser configuration.</div> : null}
            <p className="login-help">Need help accessing your clinic? <a href="mailto:support@micirql.com?subject=CapDent%20Clinic%20Portal%20Access">Contact CapDent support</a></p>
          </div>
          <p className="login-footer">CapDent by Micirql · Authentication and clinic access are enforced by Supabase.</p>
        </section>
      </div>
    </main>
  );
}

function LineChart({ values, labels, format = (value) => value }) {
  const width = 640;
  const height = 220;
  const paddingX = 26;
  const paddingY = 24;
  const safeValues = values.length ? values : [0];
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const points = safeValues.map((value, index) => {
    const x = paddingX + (index * (width - paddingX * 2)) / Math.max(safeValues.length - 1, 1);
    const y = height - paddingY - ((value - min) / range) * (height - paddingY * 2);
    return { x, y, value };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area = `${path} L ${points.at(-1).x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div className="line-chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Collection trend">
        {[0, 1, 2, 3].map((row) => <line key={row} x1={paddingX} x2={width - paddingX} y1={paddingY + row * 51} y2={paddingY + row * 51} className="chart-grid-line" />)}
        <path d={area} className="chart-area" />
        <path d={path} className="chart-line" />
        {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4.5" className="chart-point"><title>{`${labels[index] || ''}: ${format(point.value)}`}</title></circle>)}
      </svg>
      <div className="chart-labels">{labels.map((label) => <span key={label}>{label}</span>)}</div>
    </div>
  );
}

function PatientBars({ values, labels }) {
  const max = Math.max(...values, 1);
  return <div className="patient-bars" aria-label="Patient visits by day">{values.map((value, index) => <div className="patient-bar-column" key={`${labels[index]}-${value}`}><div className="patient-bar-track"><span style={{ height: `${Math.max((value / max) * 100, value ? 8 : 0)}%` }}><b>{value}</b></span></div><small>{labels[index]}</small></div>)}</div>;
}

function DonutChart({ items }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  let start = 0;
  const stops = items.map((item) => {
    const size = total ? (item.count / total) * 100 : 0;
    const end = start + size;
    const stop = `${item.colour} ${start}% ${end}%`;
    start = end;
    return stop;
  }).join(', ');

  if (!items.length) return <Empty title="No treatment activity yet" text="Treatment trends will appear after visits are recorded." />;

  return <div className="donut-layout"><div className="donut" style={{ background: `conic-gradient(${stops})` }}><div><strong>{total}</strong><span>Treatments</span></div></div><div className="donut-legend">{items.map((item) => <div key={item.label}><span style={{ background: item.colour }} /><p><strong>{item.label}</strong><small>{item.count}</small></p></div>)}</div></div>;
}

function dateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function buildSevenDaySeries(rows, dateField, valueField) {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const values = dates.map((date) => rows.filter((row) => dateKey(row[dateField]) === dateKey(date)).reduce((sum, row) => sum + (valueField ? Number(row[valueField] || 0) : 1), 0));
  const labels = dates.map((date, index) => index === 6 ? 'Today' : new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date));
  return { labels, values };
}

function Overview({ data, clinic, profile, navigate }) {
  const metrics = data.metrics;
  const revenue = buildSevenDaySeries(data.payments, 'created_at', 'amount');
  const patientFlow = buildSevenDaySeries(data.visitsSeries, 'visit_date');
  const treatmentColours = ['#087f72', '#2f6f89', '#c58a22', '#8b6cb8', '#d05b4c', '#9aabad'];
  const treatmentCounts = Object.entries(data.treatments.reduce((result, item) => {
    const name = item.treatment_name || 'Other';
    result[name] = (result[name] || 0) + 1;
    return result;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count], index) => ({ label, count, colour: treatmentColours[index] }));
  const paymentMethods = Object.entries(data.todayPayments.reduce((result, item) => {
    const method = item.payment_method || 'Other';
    result[method] = (result[method] || 0) + Number(item.amount || 0);
    return result;
  }, {})).sort((a, b) => b[1] - a[1]);
  const totalMethodAmount = paymentMethods.reduce((sum, [, amount]) => sum + amount, 0);
  const priorities = [];
  if (metrics.pendingTotal > 0) priorities.push({ level: 'urgent', icon: '₹', title: `${money(metrics.pendingTotal, clinic.currency_code)} is still pending`, text: `${data.dueInvoices.length} patient invoices need follow-up.`, action: 'View pending payments', target: 'billing' });
  if (metrics.waitingNow > 0) priorities.push({ level: 'warning', icon: '◷', title: `${metrics.waitingNow} patient${metrics.waitingNow === 1 ? '' : 's'} waiting now`, text: 'Open today’s schedule to review the waiting room.', action: 'Open appointments', target: 'appointments' });
  if (metrics.followupsToday > 0) priorities.push({ level: 'warning', icon: '↻', title: `${metrics.followupsToday} follow-up${metrics.followupsToday === 1 ? '' : 's'} due today`, text: 'Review follow-up appointments before the clinic closes.', action: 'Review follow-ups', target: 'appointments' });

  const kpis = [
    { label: 'Total patients', value: data.patientCount, note: `${metrics.newPatientsToday} added today`, trend: 'Live', tone: 'teal', icon: '👥' },
    { label: 'Patients today', value: metrics.patientsToday, note: `${data.appointments.length} appointments today`, trend: 'Today', tone: 'blue', icon: '▣' },
    { label: 'Waiting now', value: metrics.waitingNow, note: 'Checked-in and waiting patients', trend: 'Live', tone: 'amber', icon: '◷' },
    { label: 'Completed visits', value: metrics.completedToday, note: 'Completed appointments today', trend: 'Today', tone: 'green', icon: '✓' },
    { label: 'Amount collected', value: money(metrics.collectedToday, clinic.currency_code), note: `${data.todayPayments.length} payments today`, trend: 'Today', tone: 'blue', icon: '₹' },
    { label: 'Payment pending', value: money(metrics.pendingTotal, clinic.currency_code), note: `${data.dueInvoices.length} invoices with balance`, trend: metrics.pendingTotal ? 'Needs action' : 'Clear', tone: 'red', icon: '!' },
  ];

  return (
    <div className="intelligence-dashboard">
      <section className="dashboard-intro"><div><p className="dashboard-eyebrow">Live clinic intelligence</p><h2>Welcome, {profile.name || 'Clinic team'}.</h2><p>These figures come directly from {clinic.name} in Supabase.</p></div><span className="live-status">Live clinic data</span></section>
      <div className="dashboard-period"><strong>Today</strong><span>{dateText(new Date())}</span></div>
      <section className="intel-kpi-grid" aria-label="Important clinic numbers">{kpis.map((item) => <article className={`intel-kpi ${item.tone}`} key={item.label}><div className="intel-kpi-top"><span className="intel-kpi-icon">{item.icon}</span><span className="intel-trend">{item.trend}</span></div><p>{item.label}</p><strong>{item.value}</strong><small>{item.note}</small></article>)}</section>

      <section className="intelligence-card priorities-card"><div className="intelligence-card-head"><div><span className="section-kicker">Clinic priorities</span><h3>What needs attention now</h3><p>Calculated from today’s appointments and pending invoices.</p></div><span className="priority-count">{priorities.length} items</span></div><div className="priority-list">{priorities.length ? priorities.map((item) => <article className={`priority-item ${item.level}`} key={item.title}><span className="priority-icon">{item.icon}</span><div><strong>{item.title}</strong><p>{item.text}</p></div><button type="button" onClick={() => navigate(item.target)}>{item.action} →</button></article>) : <div className="all-clear"><strong>No urgent clinic priorities</strong><p>There are no waiting patients, follow-ups or outstanding balances needing immediate attention.</p></div>}</div></section>

      <div className="dashboard-grid-main">
        <section className="intelligence-card revenue-trend-card"><div className="intelligence-card-head"><div><span className="section-kicker">Collections</span><h3>Money collected over 7 days</h3><p>Payments recorded by the clinic team.</p></div><div className="headline-metric"><strong>{money(revenue.values.reduce((sum, value) => sum + value, 0), clinic.currency_code)}</strong><span>Last 7 days</span></div></div><LineChart values={revenue.values} labels={revenue.labels} format={(value) => money(value, clinic.currency_code)} /></section>
        <section className="intelligence-card patient-mix-card"><div className="intelligence-card-head"><div><span className="section-kicker">Patients</span><h3>Patient visits over 7 days</h3><p>Completed and recorded clinic visits.</p></div></div><div className="patient-mix-total"><strong>{patientFlow.values.reduce((sum, value) => sum + value, 0)}</strong><span>Recorded visits</span></div><PatientBars values={patientFlow.values} labels={patientFlow.labels} /></section>
      </div>

      <div className="dashboard-grid-secondary">
        <section className="intelligence-card treatment-card"><div className="intelligence-card-head"><div><span className="section-kicker">Treatments</span><h3>Recent treatment mix</h3><p>Grouped from the latest treatment records.</p></div><button className="card-link" type="button" onClick={() => navigate('visits')}>View visits →</button></div><DonutChart items={treatmentCounts} /></section>
        <section className="intelligence-card appointments-card"><div className="intelligence-card-head"><div><span className="section-kicker">Appointments</span><h3>Today’s patient flow</h3><p>Current appointment status from the shared CapDent database.</p></div><button className="card-link" type="button" onClick={() => navigate('appointments')}>Open schedule →</button></div><div className="flow-list">{[['Booked', metrics.bookedToday], ['Waiting', metrics.waitingNow], ['Completed', metrics.completedToday], ['Cancelled', metrics.cancelledToday], ['Missed', metrics.missedToday]].map(([label, value]) => { const base = Math.max(data.appointments.length, 1); const percent = Math.round((value / base) * 100); return <div className="flow-row" key={label}><div><strong>{label}</strong><span>{value} patients</span></div><div className="flow-track"><span style={{ width: `${percent}%` }} /></div><b>{value}</b></div>; })}</div></section>
      </div>

      <div className="dashboard-grid-secondary">
        <section className="intelligence-card payments-card"><div className="intelligence-card-head"><div><span className="section-kicker">Payments</span><h3>How patients paid today</h3><p>Payment methods recorded in CapDent.</p></div><button className="card-link" type="button" onClick={() => navigate('billing')}>View payments →</button></div><div className="payment-summary"><div><span>Collected</span><strong>{money(metrics.collectedToday, clinic.currency_code)}</strong></div><div><span>Still pending</span><strong className="negative">{money(metrics.pendingTotal, clinic.currency_code)}</strong></div><div><span>Payments</span><strong>{data.todayPayments.length}</strong></div></div>{paymentMethods.length ? <div className="payment-methods">{paymentMethods.map(([method, amount]) => { const percent = totalMethodAmount ? Math.round((amount / totalMethodAmount) * 100) : 0; return <div className="payment-method" key={method}><div><strong>{method}</strong><span>{money(amount, clinic.currency_code)}</span></div><div className="method-track"><span style={{ width: `${percent}%` }} /></div><b>{percent}%</b></div>; })}</div> : <Empty title="No payments recorded today" text="Payment method details will appear after a payment is added." />}</section>
        <section className="intelligence-card staff-activity-card"><div className="intelligence-card-head"><div><span className="section-kicker">Clinic team</span><h3>Authorised staff</h3><p>Active accounts linked to this clinic.</p></div><button className="card-link" type="button" onClick={() => navigate('staff')}>View staff →</button></div><div className="staff-activity-list">{data.staff.filter((item) => item.active).slice(0, 6).map((item) => <article key={item.id}><span>{initials(item.name)}</span><div><strong>{item.name}</strong><small>{roleLabel(item.role)}</small></div><p><b>Active</b><small>{item.email || 'No email'}</small></p></article>)}</div></section>
      </div>
      <p className="data-footnote">Live data is filtered by your signed-in clinic profile and Supabase Row Level Security.</p>
    </div>
  );
}

function Patients({ patients, profile, onCreated }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', age: '', gender: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const rows = useMemo(() => patients.filter((patient) => [patient.name, patient.phone, patient.patient_code].join(' ').toLowerCase().includes(search.toLowerCase())), [patients, search]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await createPortalPatient(profile, form);
      setForm({ name: '', phone: '', age: '', gender: '' });
      setMessage({ tone: 'success', text: 'Patient added to the shared CapDent database.' });
      await onCreated();
    } catch (error) {
      setMessage({ tone: 'error', text: error?.message || 'Unable to add patient.' });
    } finally {
      setSaving(false);
    }
  }

  return <div className="section-grid"><Card title="Add new patient" subtitle="This patient will also appear in the Android app." className="form-card"><form className="form" onSubmit={submit}><label>Patient name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>Phone number<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><div className="form-split"><label>Age<input type="number" min="0" max="130" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} /></label><label>Gender<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="">Select</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select></label></div>{message ? <p className={`form-message ${message.tone}`}>{message.text}</p> : null}<button className="primary" type="submit" disabled={saving}>{saving ? 'Adding patient…' : 'Add patient'}</button></form></Card><Card title="Patient directory" subtitle={`${rows.length} matching records`} className="table-card"><div className="toolbar"><label>⌕<input placeholder="Search name, phone or patient ID" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Age</th><th>Added</th><th>Patient ID</th></tr></thead><tbody>{rows.map((patient) => <tr key={patient.id}><td data-label="Patient"><strong>{patient.name}</strong><small>{patient.phone || 'No phone'}</small></td><td data-label="Age">{patient.age ?? '—'}<small>{patient.gender || 'Not specified'}</small></td><td data-label="Added">{dateText(patient.created_at)}</td><td data-label="Patient ID">{patient.patient_code || patient.id.slice(0, 8).toUpperCase()}</td></tr>)}</tbody></table>{!rows.length && <Empty title="No patients found" text="Try another search or add a new patient." />}</div></Card></div>;
}

function LegacyStat({ icon, label, value, meta, tone }) {
  return <article className={`stat ${tone}`}><div className="stat-icon">{icon}</div><small>{label}</small><strong>{value}</strong><p>{meta}</p></article>;
}

function Appointments({ rows, metrics }) {
  return <><div className="stat-grid compact"><LegacyStat icon="▣" label="Booked" value={metrics.bookedToday} meta="Today" tone="blue" /><LegacyStat icon="◷" label="Waiting" value={metrics.waitingNow} meta="Currently at clinic" tone="amber" /><LegacyStat icon="✓" label="Completed" value={metrics.completedToday} meta="Finished today" tone="green" /><LegacyStat icon="↗" label="Follow-ups" value={metrics.followupsToday} meta="Due today" tone="violet" /></div><Card title="Today’s schedule" subtitle={`${rows.length} appointments`}><div className="section-note">This first connected version is read-only for appointment actions. Reschedule and completion controls will be added after workflow validation.</div><div className="table-wrap"><table><thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Notes</th><th>Status</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td data-label="Time"><strong>{timeText(item.appointment_time)}</strong></td><td data-label="Patient">{item.patient?.name || 'Unknown patient'}<small>{item.patient?.phone || ''}</small></td><td data-label="Doctor">{item.doctor?.name || 'Unassigned'}</td><td data-label="Notes">{item.notes || '—'}</td><td data-label="Status"><Status value={item.status} /></td></tr>)}</tbody></table>{!rows.length && <Empty title="No appointments today" text="Today’s schedule is currently empty." />}</div></Card></>;
}

function Billing({ invoices, todayPayments, metrics, currency }) {
  return <><div className="stat-grid compact"><LegacyStat icon="₹" label="Collected today" value={money(metrics.collectedToday, currency)} meta={`${todayPayments.length} payments`} tone="green" /><LegacyStat icon="!" label="Still pending" value={money(metrics.pendingTotal, currency)} meta={`${invoices.length} invoices`} tone="amber" /><LegacyStat icon="▧" label="Payments today" value={todayPayments.length} meta="Recorded in CapDent" tone="blue" /><LegacyStat icon="↗" label="Waiting patients" value={metrics.waitingNow} meta="Current clinic queue" tone="violet" /></div><Card title="Pending patient payments" subtitle="Outstanding balances from live invoices"><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Total</th><th>Paid</th><th>Pending</th><th>Status</th></tr></thead><tbody>{invoices.map((item) => <tr key={item.id}><td data-label="Patient"><strong>{item.patient?.name || 'Unknown patient'}</strong><small>{item.patient?.phone || ''}</small></td><td data-label="Total">{money(item.total_amount, currency)}</td><td data-label="Paid">{money(item.paid_amount, currency)}</td><td data-label="Pending"><strong className="due-text">{money(item.due_amount, currency)}</strong></td><td data-label="Status"><Status value={item.status} /></td></tr>)}</tbody></table>{!invoices.length && <Empty title="No pending balances" text="All visible invoices are fully paid." />}</div></Card></>;
}

function ClinicalFiles({ rows }) {
  return <Card title="Clinical files" subtitle="Recent prescriptions, X-rays and photos"><div className="section-note">File viewing and uploads will be enabled after storage bucket permissions are validated for browsers.</div><div className="file-grid">{rows.map((file) => <article className="file-card" key={file.id}><div>{file.file_type === 'xray' ? '◫' : ['before_photo', 'after_photo'].includes(file.file_type) ? '▧' : '≡'}</div><span>{String(file.file_type || 'other').replaceAll('_', ' ')}</span><strong>{file.file_name}</strong><p>{file.patient?.name || 'Unknown patient'}</p><small>{dateText(file.created_at, { hour: '2-digit', minute: '2-digit' })}</small></article>)}</div>{!rows.length && <Empty title="No clinical files" text="No files are visible for this clinic yet." />}</Card>;
}

function Visits({ rows }) {
  return <Card title="Treatments and visits" subtitle="Recent clinic activity"><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Doctor</th><th>Complaint</th><th>Diagnosis</th><th>Date</th></tr></thead><tbody>{rows.map((visit) => <tr key={visit.id}><td data-label="Patient"><strong>{visit.patient?.name || 'Unknown patient'}</strong></td><td data-label="Doctor">{visit.doctor?.name || 'Unassigned'}</td><td data-label="Complaint">{visit.chief_complaint || '—'}</td><td data-label="Diagnosis">{visit.diagnosis || '—'}</td><td data-label="Date">{dateText(visit.visit_date, { hour: '2-digit', minute: '2-digit' })}</td></tr>)}</tbody></table>{!rows.length && <Empty title="No recent visits" text="Visit activity will appear here after it is recorded." />}</div></Card>;
}

function Staff({ rows }) {
  return <><section className="welcome slim"><div><span className="eyebrow">Team access</span><h2>Clinic staff</h2><p>Accounts currently linked to this clinic.</p></div></section><Card title="Staff accounts" subtitle={`${rows.filter((item) => item.active).length} active team members`}><div className="staff-grid">{rows.map((member) => <article className="staff-card" key={member.id}><div>{initials(member.name)}</div><span><strong>{member.name}</strong><small>{member.email || 'No email'}</small></span><b>{roleLabel(member.role)}</b><Status value={member.active ? 'active' : 'inactive'} /></article>)}</div>{!rows.length && <Empty title="No staff accounts" text="No clinic profiles are visible to this account." />}</Card></>;
}

function Reports({ data }) {
  function download(name, rows) {
    if (!rows.length) return;
    const columns = Object.keys(rows[0]);
    const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => `"${String(row[column] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const reports = [
    ['Patients report', 'Patient directory visible to this clinic', data.patients.map(({ id, patient_code, name, phone, email, age, gender, created_at }) => ({ id, patient_code, name, phone, email, age, gender, created_at }))],
    ['Appointments report', 'Today’s appointment list', data.appointments.map(({ id, appointment_time, status, notes, patient, doctor }) => ({ id, appointment_time, patient: patient?.name || '', doctor: doctor?.name || '', status, notes }))],
    ['Pending payments report', 'Invoices with outstanding balances', data.dueInvoices.map(({ id, total_amount, paid_amount, due_amount, status, patient }) => ({ id, patient: patient?.name || '', total_amount, paid_amount, due_amount, status }))],
    ['Recent visits report', 'Latest clinic visit records', data.recentVisits.map(({ id, visit_date, chief_complaint, diagnosis, visit_status, patient, doctor }) => ({ id, visit_date, patient: patient?.name || '', doctor: doctor?.name || '', chief_complaint, diagnosis, visit_status }))],
  ];

  return <div className="report-grid">{reports.map(([title, text, rows]) => <Card key={title} title={title} subtitle={text}><div className="report-card-body"><div>⇩</div><p>{rows.length} records ready to download.</p><button type="button" className="primary" disabled={!rows.length} onClick={() => download(title.toLowerCase().replaceAll(' ', '-'), rows)}>Download CSV</button></div></Card>)}</div>;
}

function Settings({ clinic, profile, onSaved }) {
  const [form, setForm] = useState(clinic);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const canEdit = ['owner', 'head_doctor'].includes(profile.role);

  useEffect(() => setForm(clinic), [clinic]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updatePortalClinic(profile, form);
      setMessage({ tone: 'success', text: 'Clinic information updated successfully.' });
      onSaved(updated);
    } catch (error) {
      setMessage({ tone: 'error', text: error?.message || 'Unable to update clinic information.' });
    } finally {
      setSaving(false);
    }
  }

  return <div className="settings-grid"><Card title="Clinic information" subtitle={canEdit ? 'Changes are shared with the Android app.' : 'Only the clinic owner can edit these details.'}><form className="form" onSubmit={save}><label>Clinic name<input disabled={!canEdit} value={form.name || ''} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div className="form-split"><label>Phone<input disabled={!canEdit} value={form.phone || ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Email<input disabled={!canEdit} value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div><label>Address<textarea disabled={!canEdit} rows="4" value={form.address || ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>{message ? <p className={`form-message ${message.tone}`}>{message.text}</p> : null}{canEdit ? <button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save clinic details'}</button> : null}</form></Card><Card title="Portal status" subtitle="Live backend connection"><div className="status-list"><div><span className="live-dot" /><p><strong>Supabase connected</strong><small>Authentication and clinic data are live</small></p></div><div><span className="connected-symbol">✓</span><p><strong>Clinic isolation active</strong><small>Queries are protected by Row Level Security</small></p></div><div><span className="connected-symbol">✓</span><p><strong>Shared CapDent data</strong><small>Updates use the same backend as the Android app</small></p></div></div></Card></div>;
}

function App() {
  const [phase, setPhase] = useState('checking');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [section, setSection] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function hydrate(nextSession, options = {}) {
    if (!nextSession?.user) {
      setSession(null);
      setProfile(null);
      setClinic(null);
      setData(EMPTY_DATA);
      setPhase('signed-out');
      return;
    }

    if (!options.silent) setPhase('loading');
    setError('');
    try {
      const context = await loadPortalContext(nextSession.user.id);
      const portalData = await loadPortalData(context.profile);
      setSession(nextSession);
      setProfile(context.profile);
      setClinic(context.clinic);
      setData(portalData);
      setLastUpdated(new Date());
      setPhase('ready');
    } catch (loadError) {
      setError(loadError?.message || 'Unable to open the clinic portal.');
      setPhase('error');
    }
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: authData }) => {
      if (active) hydrate(authData.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') window.setTimeout(() => hydrate(null), 0);
      if (event === 'SIGNED_IN' && nextSession) window.setTimeout(() => hydrate(nextSession), 0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function refresh() {
    if (!profile || !session) return;
    setRefreshing(true);
    setError('');
    try {
      const portalData = await loadPortalData(profile);
      setData(portalData);
      setLastUpdated(new Date());
    } catch (refreshError) {
      setError(refreshError?.message || 'Unable to refresh clinic data.');
    } finally {
      setRefreshing(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSection('overview');
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigate(next) {
    setSection(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (phase === 'checking' || phase === 'loading') return <PortalLoading />;
  if (phase === 'error') return <PortalError message={error} onSignOut={signOut} />;
  if (phase === 'signed-out') return <LoginScreen onSignedIn={(nextSession) => hydrate(nextSession)} />;
  if (!profile || !clinic) return <PortalLoading text="Resolving your clinic…" />;

  const title = SECTION_COPY[section];

  return (
    <div className="app-shell">
      <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand"><Logo /><div><strong>CapDent</strong><span>Clinic intelligence</span></div><button className="mobile-close" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>×</button></div>
        <div className="clinic-pill"><span className="live-dot" /><div><strong>Clinic connected</strong><small>{clinic.name}</small></div></div>
        <nav className="nav"><p>Clinic workspace</p>{NAV_ITEMS.map(([key, label, icon]) => <button type="button" key={key} className={section === key ? 'active' : ''} onClick={() => navigate(key)}><span>{icon}</span><b>{label}</b>{key === 'billing' && data.dueInvoices.length ? <em>{data.dueInvoices.length}</em> : null}</button>)}</nav>
        <div className="sidebar-footer"><div><span className="live-dot" /><strong>Supabase live</strong></div><small>Updated {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</small><button type="button" onClick={signOut}>↪ Sign out</button></div>
      </aside>
      {mobileOpen && <button type="button" className="backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <div className="workspace">
        <header className="topbar"><div className="topbar-title"><button type="button" className="menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>☰</button><div><span>CapDent clinic portal</span><h1>{title[0]}</h1><p>{title[1]}</p></div></div><div className="topbar-actions"><button type="button" className="secondary" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button><div className="owner-chip"><div>{initials(profile.name)}</div><span><strong>{profile.name}</strong><small>{roleLabel(profile.role)}</small></span></div></div></header>
        <main className="content">
          {error ? <div className="portal-banner" role="alert"><div><strong>Some clinic data could not be refreshed.</strong><p>{error}</p></div><button type="button" onClick={() => setError('')}>Dismiss</button></div> : null}
          {section === 'overview' && <Overview data={data} clinic={clinic} profile={profile} navigate={navigate} />}
          {section === 'patients' && <Patients patients={data.patients} profile={profile} onCreated={refresh} />}
          {section === 'appointments' && <Appointments rows={data.appointments} metrics={data.metrics} />}
          {section === 'billing' && <Billing invoices={data.dueInvoices} todayPayments={data.todayPayments} metrics={data.metrics} currency={clinic.currency_code} />}
          {section === 'files' && <ClinicalFiles rows={data.files} />}
          {section === 'visits' && <Visits rows={data.recentVisits} />}
          {section === 'staff' && <Staff rows={data.staff} />}
          {section === 'reports' && <Reports data={data} />}
          {section === 'settings' && <Settings clinic={clinic} profile={profile} onSaved={setClinic} />}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
