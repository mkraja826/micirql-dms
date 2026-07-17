import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './intelligence.css';

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
  overview: ['Clinic dashboard', 'A simple view of today, payments and work that needs attention.'],
  patients: ['Patient directory', 'Create, search and manage patient records.'],
  appointments: ['Appointments', 'Manage today’s schedule and patient status.'],
  billing: ['Payments & dues', 'Review collections and patients with pending amounts.'],
  files: ['Clinical files', 'Review prescriptions, X-rays and patient uploads.'],
  visits: ['Treatments & visits', 'See recent treatments and doctor activity.'],
  staff: ['Staff activity', 'Review clinic work completed by the team.'],
  reports: ['Reports & backup', 'Download clinic information in readable formats.'],
  settings: ['Clinic settings', 'Update clinic and owner contact information.'],
};

const INITIAL_PATIENTS = [
  { id: 1, name: 'Ananya Rao', phone: '98765 43210', code: 'CD-1048', age: 34, gender: 'Female', added: '16 Jul 2026' },
  { id: 2, name: 'Vikram Reddy', phone: '98480 11223', code: 'CD-1047', age: 41, gender: 'Male', added: '16 Jul 2026' },
  { id: 3, name: 'Meera Sharma', phone: '99887 66110', code: 'CD-1046', age: 27, gender: 'Female', added: '15 Jul 2026' },
  { id: 4, name: 'Rohan Kumar', phone: '97001 24567', code: 'CD-1045', age: 52, gender: 'Male', added: '15 Jul 2026' },
  { id: 5, name: 'Sana Begum', phone: '98850 44002', code: 'CD-1044', age: 30, gender: 'Female', added: '14 Jul 2026' },
];

const APPOINTMENTS = [
  { time: '09:30 AM', patient: 'Ananya Rao', treatment: 'Root canal review', status: 'waiting' },
  { time: '10:15 AM', patient: 'Vikram Reddy', treatment: 'Scaling', status: 'scheduled' },
  { time: '11:00 AM', patient: 'Meera Sharma', treatment: 'Consultation', status: 'completed' },
  { time: '12:30 PM', patient: 'Rohan Kumar', treatment: 'Crown fitting', status: 'scheduled' },
  { time: '04:00 PM', patient: 'Sana Begum', treatment: 'Follow-up', status: 'scheduled' },
];

const DUES = [
  { patient: 'Rohan Kumar', phone: '97001 24567', total: 12500, paid: 8000, due: 4500 },
  { patient: 'Ananya Rao', phone: '98765 43210', total: 9000, paid: 6500, due: 2500 },
  { patient: 'Vikram Reddy', phone: '98480 11223', total: 3200, paid: 2000, due: 1200 },
  { patient: 'Sana Begum', phone: '98850 44002', total: 5000, paid: 4500, due: 500 },
];

const FILES = [
  { patient: 'Ananya Rao', type: 'X-ray', name: 'Pre-treatment OPG', date: 'Today, 10:04 AM' },
  { patient: 'Rohan Kumar', type: 'Prescription', name: 'Post procedure medicines', date: 'Yesterday, 5:22 PM' },
  { patient: 'Meera Sharma', type: 'Photo', name: 'Before treatment', date: 'Yesterday, 11:36 AM' },
  { patient: 'Vikram Reddy', type: 'X-ray', name: 'Bitewing image', date: '14 Jul, 3:15 PM' },
];

const VISITS = [
  { patient: 'Meera Sharma', doctor: 'Dr. Clinic Owner', treatment: 'Consultation', amount: 500, date: 'Today, 11:22 AM' },
  { patient: 'Ananya Rao', doctor: 'Dr. Clinic Owner', treatment: 'Root canal', amount: 6500, date: 'Today, 10:10 AM' },
  { patient: 'Sana Begum', doctor: 'Dr. Priya', treatment: 'Follow-up', amount: 300, date: 'Yesterday, 4:45 PM' },
  { patient: 'Rohan Kumar', doctor: 'Dr. Clinic Owner', treatment: 'Crown preparation', amount: 8000, date: 'Yesterday, 12:40 PM' },
];

const STAFF = [
  { name: 'Dr. Clinic Owner', email: 'owner@clinic.com', role: 'Owner', status: 'active' },
  { name: 'Dr. Priya', email: 'doctor@clinic.com', role: 'Doctor', status: 'active' },
  { name: 'Reception Desk', email: 'reception@clinic.com', role: 'Receptionist', status: 'active' },
];

const RANGE_DATA = {
  today: {
    title: 'Today', comparison: 'compared with yesterday',
    kpis: [
      { label: 'Patients today', value: '18', note: '3 more than yesterday', trend: '+20%', tone: 'teal', icon: '👥' },
      { label: 'Waiting now', value: '4', note: 'Longest wait: 28 min', trend: 'Live', tone: 'amber', icon: '◷' },
      { label: 'Completed visits', value: '14', note: '78% of today’s list', trend: '+9%', tone: 'green', icon: '✓' },
      { label: 'Amount collected', value: '₹42,600', note: 'Across 16 payments', trend: '+8%', tone: 'blue', icon: '₹' },
      { label: 'Payment still pending', value: '₹18,400', note: 'Across 4 patients', trend: 'Needs action', tone: 'red', icon: '!' },
      { label: 'Follow-ups due', value: '7', note: '3 are already overdue', trend: 'Today', tone: 'violet', icon: '↻' },
    ],
    revenue: [6200, 9100, 5400, 11200, 7600, 13800, 12600],
    patients: [12, 16, 11, 19, 15, 22, 18],
    newPatients: 7,
    returningPatients: 11,
  },
  week: {
    title: 'Last 7 days', comparison: 'compared with the previous 7 days',
    kpis: [
      { label: 'Patients treated', value: '112', note: '14 new patients', trend: '+11%', tone: 'teal', icon: '👥' },
      { label: 'Average waiting time', value: '19 min', note: '4 minutes faster', trend: 'Improved', tone: 'amber', icon: '◷' },
      { label: 'Completed visits', value: '96', note: '86% completion rate', trend: '+6%', tone: 'green', icon: '✓' },
      { label: 'Amount collected', value: '₹2.84L', note: 'From 102 payments', trend: '+13%', tone: 'blue', icon: '₹' },
      { label: 'Payment still pending', value: '₹46,800', note: 'Across 13 patients', trend: '-7%', tone: 'red', icon: '!' },
      { label: 'Follow-ups completed', value: '31', note: '8 remain overdue', trend: '+18%', tone: 'violet', icon: '↻' },
    ],
    revenue: [6200, 9100, 5400, 11200, 7600, 13800, 12600],
    patients: [12, 16, 11, 19, 15, 21, 18],
    newPatients: 38,
    returningPatients: 74,
  },
  month: {
    title: 'This month', comparison: 'compared with last month',
    kpis: [
      { label: 'Patients treated', value: '438', note: '62 new patients', trend: '+14%', tone: 'teal', icon: '👥' },
      { label: 'Average waiting time', value: '21 min', note: '2 minutes faster', trend: 'Improved', tone: 'amber', icon: '◷' },
      { label: 'Completed visits', value: '391', note: '89% completion rate', trend: '+10%', tone: 'green', icon: '✓' },
      { label: 'Amount collected', value: '₹11.8L', note: 'Average ₹2,694 per patient', trend: '+17%', tone: 'blue', icon: '₹' },
      { label: 'Payment still pending', value: '₹1.24L', note: 'Across 29 patients', trend: '-5%', tone: 'red', icon: '!' },
      { label: 'Follow-ups completed', value: '126', note: '19 remain overdue', trend: '+12%', tone: 'violet', icon: '↻' },
    ],
    revenue: [210000, 236000, 249000, 278000, 302000, 287000, 318000],
    patients: [68, 74, 77, 82, 91, 88, 96],
    newPatients: 136,
    returningPatients: 302,
  },
};

const TREATMENTS = [
  { label: 'Root canal', value: 28, colour: '#087f72' },
  { label: 'Cleaning', value: 22, colour: '#2f6f89' },
  { label: 'Filling', value: 18, colour: '#c58a22' },
  { label: 'Extraction', value: 14, colour: '#8b6cb8' },
  { label: 'Crowns', value: 10, colour: '#d05b4c' },
  { label: 'Other', value: 8, colour: '#9aabad' },
];

const PRIORITIES = [
  { level: 'urgent', icon: '₹', title: '₹18,400 is still pending', text: 'Four patients have unpaid balances.', action: 'View pending payments', target: 'billing' },
  { level: 'warning', icon: '◷', title: 'One patient has waited 28 minutes', text: 'The usual wait is around 18 minutes.', action: 'Open waiting list', target: 'appointments' },
  { level: 'warning', icon: '↻', title: 'Three follow-ups are overdue', text: 'These patients were expected earlier this week.', action: 'Review follow-ups', target: 'patients' },
  { level: 'info', icon: '▧', title: 'Storage is 78% used', text: 'About 220 MB remains in the free clinic storage.', action: 'View storage', target: 'settings' },
];

const PAYMENT_METHODS = [
  { label: 'UPI', value: 48, amount: '₹20,450' },
  { label: 'Cash', value: 31, amount: '₹13,200' },
  { label: 'Card', value: 14, amount: '₹5,950' },
  { label: 'Bank transfer', value: 7, amount: '₹3,000' },
];

const STAFF_ACTIVITY = [
  { name: 'Reception Desk', role: 'Reception', value: '18 patients checked in', meta: '12 appointments · 6 walk-ins', initials: 'RD' },
  { name: 'Dr. Clinic Owner', role: 'Doctor', value: '9 visits completed', meta: '6 treatments updated', initials: 'CO' },
  { name: 'Dr. Priya', role: 'Doctor', value: '5 visits completed', meta: '4 treatments updated', initials: 'DP' },
];

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

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

function Status({ value }) {
  const tone = value === 'completed' || value === 'active' ? 'green' : value === 'waiting' ? 'amber' : 'blue';
  return <span className={`status ${tone}`}>{value}</span>;
}

function Card({ title, subtitle, action, className = '', children }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && <div className="card-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>}
      {children}
    </section>
  );
}

function Empty({ title, text }) {
  return <div className="empty"><span>—</span><strong>{title}</strong><p>{text}</p></div>;
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  function submit(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setMessage('Enter your clinic email and password.');
      return;
    }
    setMessage('');
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 450);
  }

  return (
    <main className="login-page">
      <a className="login-back" href="/">← Back to CapDent</a>
      <div className="login-layout">
        <section className="login-story" aria-labelledby="login-story-title">
          <div className="login-brand"><Logo /><div><strong>CapDent</strong><span>Clinic Portal</span></div></div>
          <div className="login-story-copy">
            <p className="login-overline">One clear view of your clinic</p>
            <h1 id="login-story-title">Know what is happening. Know what needs attention.</h1>
            <p>Open your clinic workspace to review patients, appointments, payments, treatments and daily activity.</p>
          </div>
          <div className="login-summary" aria-label="Clinic portal highlights">
            <div><span>Today</span><strong>Patients and waiting room</strong><small>See who has arrived, who is waiting and what is completed.</small></div>
            <div><span>Payments</span><strong>Collections and pending amounts</strong><small>Understand what was collected and what still needs follow-up.</small></div>
            <div><span>Clinic priorities</span><strong>Important work first</strong><small>Keep follow-ups, unfinished treatments and pending actions visible.</small></div>
          </div>
          <p className="login-story-note">Designed for clinic owners, doctors and reception teams.</p>
        </section>
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-panel-inner">
            <p className="login-kicker">Clinic Portal</p>
            <h2 id="login-title">Sign in to your clinic</h2>
            <p className="login-intro">Use the email and password connected to your CapDent clinic.</p>
            <form className="login-form" onSubmit={submit} noValidate>
              <label htmlFor="clinic-email">Clinic email<input id="clinic-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="doctor@clinic.com" required /></label>
              <label htmlFor="clinic-password">Password<div className="password-field"><input id="clinic-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
              {message ? <p className="login-error" role="alert">{message}</p> : null}
              <button className="login-submit" type="submit" disabled={loading}>{loading ? 'Opening clinic…' : 'Sign in to clinic'}</button>
            </form>
            <div className="login-preview-note"><strong>Portal preview</strong><p>Real clinic sign-in is not connected yet. Enter any test email and password to open the sample dashboard.</p></div>
            <p className="login-help">Need help accessing your clinic? <a href="mailto:support@micirql.com?subject=CapDent%20Clinic%20Portal%20Access">Contact CapDent support</a></p>
          </div>
          <p className="login-footer">CapDent by Micirql · Your clinic information remains private to your authorised team.</p>
        </section>
      </div>
    </main>
  );
}

function KpiCard({ item }) {
  return (
    <article className={`intel-kpi ${item.tone}`}>
      <div className="intel-kpi-top"><span className="intel-kpi-icon">{item.icon}</span><span className="intel-trend">{item.trend}</span></div>
      <p>{item.label}</p>
      <strong>{item.value}</strong>
      <small>{item.note}</small>
    </article>
  );
}

function LineChart({ values, labels, format = (value) => value }) {
  const width = 640;
  const height = 220;
  const paddingX = 26;
  const paddingY = 24;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = paddingX + (index * (width - paddingX * 2)) / Math.max(values.length - 1, 1);
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
        {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4.5" className="chart-point"><title>{`${labels[index]}: ${format(point.value)}`}</title></circle>)}
      </svg>
      <div className="chart-labels">{labels.map((label) => <span key={label}>{label}</span>)}</div>
    </div>
  );
}

function PatientBars({ values, labels }) {
  const max = Math.max(...values, 1);
  return (
    <div className="patient-bars" aria-label="Patient visits by day">
      {values.map((value, index) => <div className="patient-bar-column" key={`${labels[index]}-${value}`}><div className="patient-bar-track"><span style={{ height: `${Math.max((value / max) * 100, 8)}%` }}><b>{value}</b></span></div><small>{labels[index]}</small></div>)}
    </div>
  );
}

function DonutChart({ items }) {
  let start = 0;
  const stops = items.map((item) => {
    const end = start + item.value;
    const stop = `${item.colour} ${start}% ${end}%`;
    start = end;
    return stop;
  }).join(', ');
  return (
    <div className="donut-layout">
      <div className="donut" style={{ background: `conic-gradient(${stops})` }}><div><strong>100</strong><span>Treatments</span></div></div>
      <div className="donut-legend">{items.map((item) => <div key={item.label}><span style={{ background: item.colour }} /><p><strong>{item.label}</strong><small>{item.value}%</small></p></div>)}</div>
    </div>
  );
}

function PriorityItem({ item, navigate }) {
  return (
    <article className={`priority-item ${item.level}`}>
      <span className="priority-icon">{item.icon}</span>
      <div><strong>{item.title}</strong><p>{item.text}</p></div>
      <button type="button" onClick={() => navigate(item.target)}>{item.action} →</button>
    </article>
  );
}

function Overview({ navigate }) {
  const [range, setRange] = useState('today');
  const data = RANGE_DATA[range];
  const labels = range === 'month' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
  const totalPatients = data.newPatients + data.returningPatients;
  const newWidth = `${Math.round((data.newPatients / totalPatients) * 100)}%`;

  return (
    <div className="intelligence-dashboard">
      <section className="dashboard-intro">
        <div><p className="dashboard-eyebrow">Clinic intelligence</p><h2>Good evening. Here is your clinic at a glance.</h2><p>Important numbers, simple comparisons and the work that needs your attention.</p></div>
        <div className="range-control" aria-label="Choose report period">{[['today', 'Today'], ['week', '7 days'], ['month', 'This month']].map(([key, label]) => <button key={key} type="button" className={range === key ? 'active' : ''} aria-pressed={range === key} onClick={() => setRange(key)}>{label}</button>)}</div>
      </section>

      <div className="dashboard-period"><strong>{data.title}</strong><span>{data.comparison}</span></div>
      <section className="intel-kpi-grid" aria-label="Important clinic numbers">{data.kpis.map((item) => <KpiCard key={item.label} item={item} />)}</section>

      <section className="intelligence-card priorities-card">
        <div className="intelligence-card-head"><div><span className="section-kicker">Clinic priorities</span><h3>What needs attention now</h3><p>Start with these items before checking the detailed reports.</p></div><span className="priority-count">4 items</span></div>
        <div className="priority-list">{PRIORITIES.map((item) => <PriorityItem key={item.title} item={item} navigate={navigate} />)}</div>
      </section>

      <div className="dashboard-grid-main">
        <section className="intelligence-card revenue-trend-card">
          <div className="intelligence-card-head"><div><span className="section-kicker">Collections</span><h3>Money collected over time</h3><p>See whether the clinic is collecting more or less than before.</p></div><div className="headline-metric"><strong>{range === 'month' ? '₹11.8L' : range === 'week' ? '₹2.84L' : '₹42,600'}</strong><span>+13% improvement</span></div></div>
          <LineChart values={data.revenue} labels={labels} format={(value) => money(value)} />
        </section>

        <section className="intelligence-card patient-mix-card">
          <div className="intelligence-card-head"><div><span className="section-kicker">Patients</span><h3>New and returning patients</h3><p>Returning patients show how well the clinic keeps relationships.</p></div></div>
          <div className="patient-mix-total"><strong>{totalPatients}</strong><span>Total patients</span></div>
          <div className="mix-bar"><span className="new" style={{ width: newWidth }} /><span className="returning" /></div>
          <div className="mix-legend"><div><span className="new-dot" /><p><strong>{data.newPatients}</strong><small>New patients</small></p></div><div><span className="return-dot" /><p><strong>{data.returningPatients}</strong><small>Returning patients</small></p></div></div>
          <PatientBars values={data.patients} labels={labels} />
        </section>
      </div>

      <div className="dashboard-grid-secondary">
        <section className="intelligence-card treatment-card">
          <div className="intelligence-card-head"><div><span className="section-kicker">Treatments</span><h3>Most common treatments</h3><p>A clear view of the clinic’s treatment workload.</p></div><button className="card-link" type="button" onClick={() => navigate('visits')}>View treatments →</button></div>
          <DonutChart items={TREATMENTS} />
        </section>

        <section className="intelligence-card appointments-card">
          <div className="intelligence-card-head"><div><span className="section-kicker">Appointments</span><h3>Today’s patient flow</h3><p>From booked appointments to completed visits.</p></div><button className="card-link" type="button" onClick={() => navigate('appointments')}>Open schedule →</button></div>
          <div className="flow-list">
            {[['Booked', 24, 100, '24 patients'], ['Arrived', 18, 75, '18 patients'], ['Completed', 14, 58, '14 patients'], ['Rescheduled', 3, 13, '3 patients'], ['Missed', 1, 4, '1 patient']].map(([label, value, percent, text]) => <div className="flow-row" key={label}><div><strong>{label}</strong><span>{text}</span></div><div className="flow-track"><span style={{ width: `${percent}%` }} /></div><b>{value}</b></div>)}
          </div>
          <div className="waiting-summary"><div><span>Average waiting time</span><strong>18 min</strong><small>4 min faster than last week</small></div><div><span>Busiest time today</span><strong>5–7 PM</strong><small>Plan one extra staff member</small></div></div>
        </section>
      </div>

      <div className="dashboard-grid-secondary">
        <section className="intelligence-card payments-card">
          <div className="intelligence-card-head"><div><span className="section-kicker">Payments</span><h3>How patients paid today</h3><p>Simple payment split and pending balance review.</p></div><button className="card-link" type="button" onClick={() => navigate('billing')}>View payments →</button></div>
          <div className="payment-summary"><div><span>Collected</span><strong>₹42,600</strong></div><div><span>Still pending</span><strong className="negative">₹18,400</strong></div><div><span>Collection rate</span><strong>70%</strong></div></div>
          <div className="payment-methods">{PAYMENT_METHODS.map((method) => <div className="payment-method" key={method.label}><div><strong>{method.label}</strong><span>{method.amount}</span></div><div className="method-track"><span style={{ width: `${method.value}%` }} /></div><b>{method.value}%</b></div>)}</div>
          <div className="highest-due"><span>Highest pending balance</span><strong>Rohan Kumar · ₹4,500</strong><button type="button" onClick={() => navigate('billing')}>Review patient</button></div>
        </section>

        <section className="intelligence-card staff-activity-card">
          <div className="intelligence-card-head"><div><span className="section-kicker">Team activity</span><h3>Work completed today</h3><p>A simple summary of clinic activity by role.</p></div><button className="card-link" type="button" onClick={() => navigate('staff')}>View staff →</button></div>
          <div className="staff-activity-list">{STAFF_ACTIVITY.map((item) => <article key={item.name}><span>{item.initials}</span><div><strong>{item.name}</strong><small>{item.role}</small></div><p><b>{item.value}</b><small>{item.meta}</small></p></article>)}</div>
          <div className="clinic-note"><span>Helpful note</span><p>Patient visits are strongest between 5 PM and 7 PM. Keeping reception support during this time may reduce waiting.</p></div>
        </section>
      </div>

      <p className="demo-data-note">Dashboard preview uses fictional clinic data. Live figures will appear after Supabase reports and real clinic authentication are connected.</p>
    </div>
  );
}

function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [section, setSection] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [clinic, setClinic] = useState({ name: 'Sri B.G. Reddy Dental Clinic', phone: '+91 98765 43210', email: 'clinic@example.com', address: 'Hyderabad, Telangana' });
  const title = SECTION_COPY[section];

  function navigate(next) {
    setSection(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function refresh() {
    setRefreshing(true);
    window.setTimeout(() => { setLastUpdated(new Date()); setRefreshing(false); }, 500);
  }

  function signOut() {
    setSignedIn(false);
    setMobileOpen(false);
    setSection('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!signedIn) return <LoginScreen onLogin={() => { setSignedIn(true); window.scrollTo({ top: 0 }); }} />;

  return (
    <div className="app-shell">
      <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand"><Logo /><div><strong>CapDent</strong><span>Clinic intelligence</span></div><button className="mobile-close" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>×</button></div>
        <div className="clinic-pill"><span className="live-dot" /><div><strong>Clinic connected</strong><small>{clinic.name}</small></div></div>
        <nav className="nav"><p>Clinic workspace</p>{NAV_ITEMS.map(([key, label, icon]) => <button type="button" key={key} className={section === key ? 'active' : ''} onClick={() => navigate(key)}><span>{icon}</span><b>{label}</b>{key === 'billing' ? <em>{DUES.length}</em> : null}</button>)}</nav>
        <div className="sidebar-footer"><div><span className="live-dot" /><strong>Sample data ready</strong></div><small>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small><button type="button" onClick={signOut}>↪ Sign out</button></div>
      </aside>
      {mobileOpen && <button type="button" className="backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title"><button type="button" className="menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>☰</button><div><span>CapDent clinic portal</span><h1>{title[0]}</h1><p>{title[1]}</p></div></div>
          <div className="topbar-actions"><button type="button" className="secondary" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button><div className="owner-chip"><div>K</div><span><strong>Clinic Owner</strong><small>Owner / Head doctor</small></span></div></div>
        </header>
        <main className="content">
          {section === 'overview' && <Overview navigate={navigate} />}
          {section === 'patients' && <Patients patients={patients} setPatients={setPatients} />}
          {section === 'appointments' && <Appointments />}
          {section === 'billing' && <Billing />}
          {section === 'files' && <ClinicalFiles />}
          {section === 'visits' && <Visits />}
          {section === 'staff' && <Staff />}
          {section === 'reports' && <Reports patients={patients} />}
          {section === 'settings' && <Settings clinic={clinic} setClinic={setClinic} />}
        </main>
      </div>
    </div>
  );
}

function Patients({ patients, setPatients }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', age: '', gender: '' });
  const rows = useMemo(() => patients.filter((patient) => [patient.name, patient.phone, patient.code].join(' ').toLowerCase().includes(search.toLowerCase())), [patients, search]);
  function submit(event) {
    event.preventDefault();
    const next = { id: Date.now(), ...form, code: `CD-${1048 + patients.length}`, added: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) };
    setPatients([next, ...patients]);
    setForm({ name: '', phone: '', age: '', gender: '' });
  }
  return <div className="section-grid"><Card title="Add new patient" subtitle="Keep the patient directory clean and searchable." className="form-card"><form className="form" onSubmit={submit}><label>Patient name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>Phone number<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><div className="form-split"><label>Age<input value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} /></label><label>Gender<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></label></div><button className="primary" type="submit">Add patient</button></form></Card><Card title="Patient directory" subtitle={`${rows.length} matching records`} className="table-card"><div className="toolbar"><label>⌕<input placeholder="Search name, phone or patient ID" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Age</th><th>Added</th><th>Actions</th></tr></thead><tbody>{rows.map((patient) => <tr key={patient.id}><td data-label="Patient"><strong>{patient.name}</strong><small>{patient.phone || 'No phone'} • {patient.code}</small></td><td data-label="Age">{patient.age || '—'}<small>{patient.gender}</small></td><td data-label="Added">{patient.added}</td><td data-label="Actions"><div className="row-actions"><button type="button">Open</button><button type="button">Edit</button><button type="button" className="danger" onClick={() => setPatients(patients.filter((item) => item.id !== patient.id))}>Delete</button></div></td></tr>)}</tbody></table>{!rows.length && <Empty title="No patients found" text="Try another search or add a new patient." />}</div></Card></div>;
}

function Appointments() {
  return <><div className="stat-grid compact"><LegacyStat icon="▣" label="Booked" value="24" meta="Today" tone="blue" /><LegacyStat icon="◷" label="Waiting" value="4" meta="Currently at clinic" tone="amber" /><LegacyStat icon="✓" label="Completed" value="14" meta="Finished today" tone="green" /><LegacyStat icon="↗" label="Follow-ups" value="7" meta="Due today" tone="violet" /></div><Card title="Today’s schedule" subtitle="Appointment status and patient details"><div className="table-wrap"><table><thead><tr><th>Time</th><th>Patient</th><th>Treatment</th><th>Status</th><th>Actions</th></tr></thead><tbody>{APPOINTMENTS.map((item) => <tr key={`${item.time}-${item.patient}`}><td data-label="Time"><strong>{item.time}</strong></td><td data-label="Patient">{item.patient}</td><td data-label="Treatment">{item.treatment}</td><td data-label="Status"><Status value={item.status} /></td><td data-label="Actions"><div className="row-actions"><button type="button">Reschedule</button><button type="button">Complete</button></div></td></tr>)}</tbody></table></div></Card></>;
}

function LegacyStat({ icon, label, value, meta, tone }) {
  return <article className={`stat ${tone}`}><div className="stat-icon">{icon}</div><small>{label}</small><strong>{value}</strong><p>{meta}</p></article>;
}

function Billing() {
  const totalDue = DUES.reduce((sum, item) => sum + item.due, 0);
  return <><div className="stat-grid compact"><LegacyStat icon="₹" label="Collected today" value={money(42600)} meta="16 payments" tone="green" /><LegacyStat icon="!" label="Still pending" value={money(totalDue)} meta={`${DUES.length} patients`} tone="amber" /><LegacyStat icon="▧" label="Bills made" value="18" meta="Today" tone="blue" /><LegacyStat icon="↗" label="Collection rate" value="70%" meta="Today" tone="violet" /></div><Card title="Pending patient payments" subtitle="Amounts that need follow-up"><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Total</th><th>Paid</th><th>Pending</th><th>Actions</th></tr></thead><tbody>{DUES.map((item) => <tr key={item.patient}><td data-label="Patient"><strong>{item.patient}</strong><small>{item.phone}</small></td><td data-label="Total">{money(item.total)}</td><td data-label="Paid">{money(item.paid)}</td><td data-label="Pending"><strong className="due-text">{money(item.due)}</strong></td><td data-label="Actions"><div className="row-actions"><button type="button">Record payment</button><button type="button">WhatsApp</button></div></td></tr>)}</tbody></table></div></Card></>;
}

function ClinicalFiles() {
  return <Card title="Clinical files" subtitle="Recent prescriptions, X-rays and photos" action={<button type="button" className="primary small">+ Upload file</button>}><div className="file-grid">{FILES.map((file) => <article className="file-card" key={`${file.patient}-${file.name}`}><div>{file.type === 'X-ray' ? '◫' : file.type === 'Photo' ? '▧' : '≡'}</div><span>{file.type}</span><strong>{file.name}</strong><p>{file.patient}</p><small>{file.date}</small><button type="button">Open file →</button></article>)}</div></Card>;
}

function Visits() {
  return <Card title="Treatments and visits" subtitle="Recent clinic activity"><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Doctor</th><th>Treatment</th><th>Amount</th><th>Date</th></tr></thead><tbody>{VISITS.map((visit) => <tr key={`${visit.patient}-${visit.date}`}><td data-label="Patient"><strong>{visit.patient}</strong></td><td data-label="Doctor">{visit.doctor}</td><td data-label="Treatment">{visit.treatment}</td><td data-label="Amount">{money(visit.amount)}</td><td data-label="Date">{visit.date}</td></tr>)}</tbody></table></div></Card>;
}

function Staff() {
  return <><section className="welcome slim"><div><span className="eyebrow">Team access</span><h2>Clinic staff</h2><p>Control who can access the clinic workspace.</p></div><button type="button" className="primary">+ Invite staff</button></section><Card title="Staff accounts" subtitle={`${STAFF.length} active team members`}><div className="staff-grid">{STAFF.map((member) => <article className="staff-card" key={member.email}><div>{member.name.slice(0, 1)}</div><span><strong>{member.name}</strong><small>{member.email}</small></span><b>{member.role}</b><Status value={member.status} /><button type="button">Manage</button></article>)}</div></Card></>;
}

function Reports({ patients }) {
  function download(name, rows) {
    const columns = Object.keys(rows[0] || {});
    const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => `"${String(row[column] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const reports = [['Patients report', 'Complete patient directory', patients], ['Appointments report', 'Schedule and appointment status', APPOINTMENTS], ['Payments report', 'Collections and pending payments', DUES], ['Treatment report', 'Treatments and doctor activity', VISITS]];
  return <div className="report-grid">{reports.map(([title, text, rows]) => <Card key={title} title={title} subtitle={text}><div className="report-card-body"><div>⇩</div><p>{rows.length} records ready to download.</p><button type="button" className="primary" onClick={() => download(title.toLowerCase().replaceAll(' ', '-'), rows)}>Download CSV</button></div></Card>)}</div>;
}

function Settings({ clinic, setClinic }) {
  const [form, setForm] = useState(clinic);
  function save(event) { event.preventDefault(); setClinic(form); }
  return <div className="settings-grid"><Card title="Clinic information" subtitle="Used throughout the clinic portal"><form className="form" onSubmit={save}><label>Clinic name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div className="form-split"><label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Email<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div><label>Address<textarea rows="4" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label><button className="primary" type="submit">Save clinic details</button></form></Card><Card title="Portal status" subtitle="Dashboard setup information"><div className="status-list"><div><span className="live-dot" /><p><strong>Clinic Intelligence design installed</strong><small>Clear KPIs, charts and clinic priorities</small></p></div><div><span className="status-symbol">◇</span><p><strong>Live data not connected</strong><small>Supabase reports and secure sign-in are the next step</small></p></div><div><span className="status-symbol">✓</span><p><strong>Works on every screen</strong><small>Desktop, tablet and mobile layouts included</small></p></div></div></Card></div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
