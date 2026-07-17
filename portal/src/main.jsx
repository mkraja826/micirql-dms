import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const NAV_ITEMS = [
  ['overview', 'Overview', '⌂'],
  ['patients', 'Patients', '👥'],
  ['appointments', 'Appointments', '▣'],
  ['billing', 'Billing & dues', '₹'],
  ['files', 'Clinical files', '▧'],
  ['visits', 'Visit audit', '🦷'],
  ['staff', 'Staff & access', '♟'],
  ['reports', 'Reports', '⇩'],
  ['settings', 'Clinic settings', '⚙'],
];

const SECTION_COPY = {
  overview: ['Clinic overview', 'Today’s workload, revenue and operational signals.'],
  patients: ['Patient directory', 'Create, search and manage patient records.'],
  appointments: ['Appointments', 'Manage the clinic schedule and appointment status.'],
  billing: ['Billing & dues', 'Review collections and patients with pending amounts.'],
  files: ['Clinical files', 'Review prescriptions, X-rays and patient uploads.'],
  visits: ['Visit audit', 'See recent treatment and doctor activity.'],
  staff: ['Staff & access', 'Manage clinic roles and team access.'],
  reports: ['Reports & backup', 'Export clinic information in readable formats.'],
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

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

function Logo({ large = false }) {
  return <div className={large ? 'brand-mark large' : 'brand-mark'}><span>+</span></div>;
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

function StatCard({ icon, label, value, meta, tone }) {
  return <article className={`stat ${tone}`}><div className="stat-icon">{icon}</div><small>{label}</small><strong>{value}</strong><p>{meta}</p></article>;
}

function Empty({ title, text }) {
  return <div className="empty"><span>—</span><strong>{title}</strong><p>{text}</p></div>;
}

function App() {
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

  const contentProps = { patients, setPatients, clinic, setClinic, navigate };

  return (
    <div className="app-shell">
      <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand"><Logo /><div><strong>CapDent</strong><span>Owner control panel</span></div><button className="mobile-close" type="button" onClick={() => setMobileOpen(false)}>×</button></div>
        <div className="clinic-pill"><span className="live-dot" /><div><strong>Clinic connected</strong><small>{clinic.name}</small></div></div>
        <nav className="nav">
          <p>Clinic workspace</p>
          {NAV_ITEMS.map(([key, label, icon]) => <button type="button" key={key} className={section === key ? 'active' : ''} onClick={() => navigate(key)}><span>{icon}</span><b>{label}</b>{key === 'billing' ? <em>{DUES.length}</em> : null}</button>)}
        </nav>
        <div className="sidebar-footer"><div><span className="live-dot" /><strong>Data status</strong></div><small>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small><button type="button">↪ Sign out</button></div>
      </aside>

      {mobileOpen && <button type="button" className="backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title"><button type="button" className="menu-button" onClick={() => setMobileOpen(true)}>☰</button><div><span>Single clinic owner dashboard</span><h1>{title[0]}</h1><p>{title[1]}</p></div></div>
          <div className="topbar-actions"><button type="button" className="secondary" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button><div className="owner-chip"><div>K</div><span><strong>Clinic Owner</strong><small>Owner / Head doctor</small></span></div></div>
        </header>

        <main className="content">
          {section === 'overview' && <Overview {...contentProps} />}
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

function Overview({ patients, navigate }) {
  const revenue = 28450;
  return (
    <>
      <section className="welcome"><div><span className="eyebrow">Owner command center</span><h2>Good evening.</h2><p>Here is what is happening at the clinic today.</p></div><div className="welcome-actions"><button type="button" onClick={() => navigate('patients')}>+ Add patient</button><button type="button" onClick={() => navigate('appointments')}>Open schedule</button></div></section>
      <div className="stat-grid">
        <StatCard icon="₹" label="Today’s revenue" value={money(9300)} meta="Collected today" tone="green" />
        <StatCard icon="!" label="Pending amount" value={money(8700)} meta={`${DUES.length} patient records`} tone="amber" />
        <StatCard icon="◷" label="Waiting queue" value="2" meta="3 completed today" tone="violet" />
        <StatCard icon="👥" label="Patients today" value="7" meta={`${patients.length} demo records`} tone="blue" />
      </div>
      <section className="revenue-panel"><div><span>Monthly collection</span><h3>July 2026</h3><p>Live summary area ready for your Supabase payment records.</p></div><div className="revenue-total"><strong>{money(revenue)}</strong><span>18 payments this month</span></div><div className="revenue-metrics"><div><small>Average / day</small><b>{money(1778)}</b></div><div><small>Best collection day</small><b>{money(9300)}</b></div><div><small>Visits recorded</small><b>{VISITS.length}</b></div><div><small>Clinical uploads</small><b>{FILES.length}</b></div></div></section>
      <div className="two-column">
        <Card title="Today’s appointments" subtitle={`${APPOINTMENTS.length} schedule records`} action={<button type="button" className="text-button" onClick={() => navigate('appointments')}>View schedule →</button>}><AppointmentRows items={APPOINTMENTS} /></Card>
        <Card title="Pending dues" subtitle={`${DUES.length} patients need follow-up`} action={<button type="button" className="text-button" onClick={() => navigate('billing')}>Open billing →</button>}><DueRows items={DUES} /></Card>
      </div>
      <div className="two-column"><Card title="Recent visits" subtitle="Doctor activity"><VisitRows items={VISITS} /></Card><Card title="Recent clinical files" subtitle="Prescription, X-ray and photo uploads"><FileRows items={FILES} /></Card></div>
    </>
  );
}

function Patients({ patients, setPatients }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', age: '', gender: '' });
  const rows = useMemo(() => patients.filter((p) => [p.name, p.phone, p.code].join(' ').toLowerCase().includes(search.toLowerCase())), [patients, search]);

  function submit(event) {
    event.preventDefault();
    const next = { id: Date.now(), ...form, code: `CD-${1048 + patients.length}`, added: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) };
    setPatients([next, ...patients]);
    setForm({ name: '', phone: '', age: '', gender: '' });
  }

  return <div className="section-grid"><Card title="Add new patient" subtitle="Keep the patient directory clean and searchable." className="form-card"><form className="form" onSubmit={submit}><label>Patient name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Phone number<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><div className="form-split"><label>Age<input value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></label><label>Gender<select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></label></div><button className="primary" type="submit">Add patient</button></form></Card><Card title="Patient directory" subtitle={`${rows.length} matching records`} className="table-card"><div className="toolbar"><label>⌕<input placeholder="Search name, phone or patient ID" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Age</th><th>Added</th><th>Actions</th></tr></thead><tbody>{rows.map((patient) => <tr key={patient.id}><td data-label="Patient"><strong>{patient.name}</strong><small>{patient.phone || 'No phone'} • {patient.code}</small></td><td data-label="Age">{patient.age || '—'}<small>{patient.gender}</small></td><td data-label="Added">{patient.added}</td><td data-label="Actions"><div className="row-actions"><button type="button">Open</button><button type="button">Edit</button><button type="button" className="danger" onClick={() => setPatients(patients.filter((p) => p.id !== patient.id))}>Delete</button></div></td></tr>)}</tbody></table>{!rows.length && <Empty title="No patients found" text="Try another search or add a new patient." />}</div></Card></div>;
}

function Appointments() {
  return <><div className="stat-grid compact"><StatCard icon="▣" label="Scheduled" value="3" meta="Upcoming today" tone="blue" /><StatCard icon="◷" label="Waiting" value="1" meta="Currently at clinic" tone="amber" /><StatCard icon="✓" label="Completed" value="1" meta="Finished today" tone="green" /><StatCard icon="↗" label="Follow-ups" value="4" meta="Due this week" tone="violet" /></div><Card title="Today’s schedule" subtitle="Appointment status and patient details"><div className="table-wrap"><table><thead><tr><th>Time</th><th>Patient</th><th>Treatment</th><th>Status</th><th>Actions</th></tr></thead><tbody>{APPOINTMENTS.map((item) => <tr key={`${item.time}-${item.patient}`}><td data-label="Time"><strong>{item.time}</strong></td><td data-label="Patient">{item.patient}</td><td data-label="Treatment">{item.treatment}</td><td data-label="Status"><Status value={item.status} /></td><td data-label="Actions"><div className="row-actions"><button type="button">Reschedule</button><button type="button">Complete</button></div></td></tr>)}</tbody></table></div></Card></>;
}

function Billing() {
  const totalDue = DUES.reduce((sum, item) => sum + item.due, 0);
  return <><div className="stat-grid compact"><StatCard icon="₹" label="Collected today" value={money(9300)} meta="5 payments" tone="green" /><StatCard icon="!" label="Outstanding" value={money(totalDue)} meta={`${DUES.length} patients`} tone="amber" /><StatCard icon="▧" label="Invoices" value="12" meta="This month" tone="blue" /><StatCard icon="↗" label="Collection rate" value="76%" meta="This month" tone="violet" /></div><Card title="Pending patient dues" subtitle="Amounts requiring collection follow-up"><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Total</th><th>Paid</th><th>Pending</th><th>Actions</th></tr></thead><tbody>{DUES.map((item) => <tr key={item.patient}><td data-label="Patient"><strong>{item.patient}</strong><small>{item.phone}</small></td><td data-label="Total">{money(item.total)}</td><td data-label="Paid">{money(item.paid)}</td><td data-label="Pending"><strong className="due-text">{money(item.due)}</strong></td><td data-label="Actions"><div className="row-actions"><button type="button">Record payment</button><button type="button">WhatsApp</button></div></td></tr>)}</tbody></table></div></Card></>;
}

function ClinicalFiles() {
  return <Card title="Clinical files" subtitle="Recent prescriptions, X-rays and photos" action={<button type="button" className="primary small">+ Upload file</button>}><div className="file-grid">{FILES.map((file) => <article className="file-card" key={`${file.patient}-${file.name}`}><div>{file.type === 'X-ray' ? '◫' : file.type === 'Photo' ? '▧' : '≡'}</div><span>{file.type}</span><strong>{file.name}</strong><p>{file.patient}</p><small>{file.date}</small><button type="button">Open file →</button></article>)}</div></Card>;
}

function Visits() {
  return <Card title="Visit audit" subtitle="Recent clinic activity"><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Doctor</th><th>Treatment</th><th>Amount</th><th>Date</th></tr></thead><tbody>{VISITS.map((visit) => <tr key={`${visit.patient}-${visit.date}`}><td data-label="Patient"><strong>{visit.patient}</strong></td><td data-label="Doctor">{visit.doctor}</td><td data-label="Treatment">{visit.treatment}</td><td data-label="Amount">{money(visit.amount)}</td><td data-label="Date">{visit.date}</td></tr>)}</tbody></table></div></Card>;
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
  const reports = [['Patients report', 'Complete patient directory', patients], ['Appointments report', 'Schedule and appointment status', APPOINTMENTS], ['Billing report', 'Patient collections and pending dues', DUES], ['Visit audit report', 'Treatments and doctor activity', VISITS]];
  return <div className="report-grid">{reports.map(([title, text, rows]) => <Card key={title} title={title} subtitle={text}><div className="report-card-body"><div>⇩</div><p>{rows.length} records ready to export.</p><button type="button" className="primary" onClick={() => download(title.toLowerCase().replaceAll(' ', '-'), rows)}>Download CSV</button></div></Card>)}</div>;
}

function Settings({ clinic, setClinic }) {
  const [form, setForm] = useState(clinic);
  function save(event) { event.preventDefault(); setClinic(form); }
  return <div className="settings-grid"><Card title="Clinic information" subtitle="Used throughout the owner portal"><form className="form" onSubmit={save}><label>Clinic name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><div className="form-split"><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div><label>Address<textarea rows="4" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label><button className="primary" type="submit">Save clinic details</button></form></Card><Card title="Portal status" subtitle="Dashboard setup information"><div className="status-list"><div><span className="live-dot" /><p><strong>Dashboard design installed</strong><small>Standalone CapDent owner portal</small></p></div><div><span className="status-symbol">◇</span><p><strong>Backend not connected</strong><small>Connect Supabase when database workflows are ready</small></p></div><div><span className="status-symbol">✓</span><p><strong>Responsive layout</strong><small>Desktop, tablet and mobile navigation included</small></p></div></div></Card></div>;
}

function AppointmentRows({ items }) {
  return <div className="list">{items.map((item) => <div className="list-row" key={`${item.time}-${item.patient}`}><div className="time-box">{item.time.replace(' ', '\n')}</div><span><strong>{item.patient}</strong><small>{item.treatment}</small></span><Status value={item.status} /></div>)}</div>;
}

function DueRows({ items }) {
  return <div className="list">{items.map((item) => <div className="list-row" key={item.patient}><div className="avatar">{item.patient.slice(0, 1)}</div><span><strong>{item.patient}</strong><small>{item.phone}</small></span><b className="due-text">{money(item.due)}</b></div>)}</div>;
}

function VisitRows({ items }) {
  return <div className="list">{items.map((item) => <div className="list-row" key={`${item.patient}-${item.date}`}><div className="avatar tooth">🦷</div><span><strong>{item.patient}</strong><small>{item.treatment} • {item.doctor}</small></span><b>{money(item.amount)}</b></div>)}</div>;
}

function FileRows({ items }) {
  return <div className="list">{items.map((item) => <div className="list-row" key={`${item.patient}-${item.name}`}><div className="avatar file">{item.type === 'X-ray' ? '◫' : '▧'}</div><span><strong>{item.name}</strong><small>{item.patient} • {item.date}</small></span><b>{item.type}</b></div>)}</div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
