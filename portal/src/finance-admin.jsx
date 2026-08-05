import React, { useEffect, useMemo, useState } from 'react';
import './finance-admin.css';
import {
  correctPayment,
  discountInvoice,
  loadFinancialAdmin,
  loadInvoiceFinancialHistory,
  refundPayment,
  voidPayment,
  waiveInvoice,
} from './finance-admin-data';

const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(Number(value || 0));
const dateTime = (value) => value ? new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value)) : '—';
const localInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};
const titleCase = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const emptyData = { invoices: [], payments: [], adjustments: [] };
const emptyHistory = { payments: [], adjustments: [], versions: [] };

function Status({ value }) {
  const kind = value === 'paid' || value === 'active' || value === 'corrected'
    ? 'good'
    : value === 'voided' || value === 'refund'
      ? 'danger'
      : value === 'partial'
        ? 'warn'
        : '';
  return <span className={`finance-status ${kind}`}>{titleCase(value || 'unknown')}</span>;
}

function DailyCollections({ payments, monthStart, currency }) {
  const start = new Date(monthStart);
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const totals = Array.from({ length: days }, (_, index) => payments
    .filter((row) => new Date(row.created_at).getDate() === index + 1)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const max = Math.max(...totals.map((value) => Math.abs(value)), 1);
  return <div className="finance-daily" aria-label="Daily net collections">
    <div className="finance-daily-bars">{totals.map((value, index) => <div className="finance-day" key={index} title={`${index + 1}: ${money(value, currency)}`}>
      <span className={value < 0 ? 'negative' : ''} style={{ height: `${Math.max(Math.abs(value) / max * 100, value ? 4 : 0)}%` }} />
    </div>)}</div>
    <div className="finance-daily-labels"><span>1</span><span>{Math.ceil(days / 2)}</span><span>{days}</span></div>
  </div>;
}

function AdjustmentModal({ action, currency, onClose, onSaved }) {
  const target = action.target;
  const isInvoiceAction = ['discount', 'waiver'].includes(action.type);
  const [form, setForm] = useState(() => ({
    amount: action.type === 'correct' ? String(target.amount || '') : '',
    payment_method: target.payment_method || 'Cash',
    payment_category: target.payment_category || 'treatment_fee',
    paid_at: action.type === 'correct' ? localInput(target.created_at) : '',
    notes: target.notes || '',
    reason: '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const heading = {
    correct: 'Correct payment entry', refund: 'Issue patient refund', void: target.status === 'refund' ? 'Void refund entry' : 'Void payment',
    discount: 'Apply treatment discount', waiver: 'Waive outstanding balance',
  }[action.type];

  async function submit(event) {
    event.preventDefault();
    if (form.reason.trim().length < 3) return setError('Enter a clear reason for this financial adjustment.');
    if (action.type !== 'void' && Number(form.amount) <= 0) return setError('Enter an amount greater than zero.');
    setBusy(true); setError('');
    try {
      if (action.type === 'correct') await correctPayment(target.id, form);
      if (action.type === 'refund') await refundPayment(target.id, form);
      if (action.type === 'void') await voidPayment(target.id, form);
      if (action.type === 'discount') await discountInvoice(target.id, form);
      if (action.type === 'waiver') await waiveInvoice(target.id, form);
      await onSaved(`${heading} saved with an audit record.`);
    } catch (err) {
      setError(err?.message || 'Unable to save this financial adjustment.');
    } finally { setBusy(false); }
  }

  const currentDue = Number(target.due_amount || 0);
  const previewAmount = Number(form.amount || 0);
  return <div className="finance-modal" role="dialog" aria-modal="true" aria-label={heading}>
    <form className="finance-modal-card" onSubmit={submit}>
      <div className="finance-modal-head"><div><h3>{heading}</h3><p>{target.patient?.name || 'Patient'} · {isInvoiceAction ? `Invoice v${target.version_number}` : money(target.amount, currency)}</p></div><button type="button" onClick={onClose}>×</button></div>
      {isInvoiceAction ? <div className="finance-preview"><div><span>Current due</span><strong>{money(currentDue, currency)}</strong></div><div><span>After adjustment</span><strong>{money(Math.max(currentDue - previewAmount, 0), currency)}</strong></div></div> : null}
      {action.type === 'correct' || action.type === 'refund' || isInvoiceAction ? <label>Amount<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label> : null}
      {action.type === 'correct' || action.type === 'refund' ? <label>{action.type === 'refund' ? 'Refund method' : 'Payment method'}<select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}><option>Cash</option><option>UPI</option><option>Card</option><option>Bank transfer</option><option>Other</option></select></label> : null}
      {action.type === 'correct' ? <><label>Payment category<select value={form.payment_category} onChange={(event) => setForm({ ...form, payment_category: event.target.value })}><option value="op_fee">OP fee</option><option value="xray_fee">X-ray fee</option><option value="medication_fee">Medication fee</option><option value="treatment_fee">Treatment fee</option><option value="pending_collection">Pending collection</option><option value="other">Other</option></select></label><label>Payment date and time<input type="datetime-local" value={form.paid_at} onChange={(event) => setForm({ ...form, paid_at: event.target.value })} /></label></> : null}
      <label>Reason<textarea rows="3" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Why is this adjustment necessary?" /></label>
      <label>Internal note<textarea rows="2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional context for the clinic audit trail" /></label>
      {action.type === 'void' ? <div className="finance-danger-note">This entry will remain in history, but its effective amount will become zero.</div> : null}
      {action.type === 'refund' ? <div className="finance-warning-note">The refund will reduce net collection and increase the invoice balance unless a discount or waiver is also applied.</div> : null}
      {error ? <div className="finance-error">{error}</div> : null}
      <div className="finance-modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className={action.type === 'void' ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Saving…' : `Confirm ${heading.toLowerCase()}`}</button></div>
    </form>
  </div>;
}

function InvoiceDrawer({ invoice, history, loading, currency, onClose, onAction }) {
  return <aside className="finance-drawer">
    <div className="finance-drawer-head"><div><h3>{invoice.patient?.name || 'Invoice'}</h3><p>{invoice.patient?.patient_code || invoice.id.slice(0, 8)} · Version {invoice.version_number}</p></div><button onClick={onClose}>×</button></div>
    <div className="finance-invoice-summary">
      <div><span>Original value</span><strong>{money(invoice.original_total_amount, currency)}</strong></div>
      <div><span>Discounts</span><strong>−{money(invoice.discount_amount, currency)}</strong></div>
      <div><span>Waivers</span><strong>−{money(invoice.waived_amount, currency)}</strong></div>
      <div><span>Net invoice</span><strong>{money(invoice.total_amount, currency)}</strong></div>
      <div><span>Net paid</span><strong>{money(invoice.paid_amount, currency)}</strong></div>
      <div><span>Refunded</span><strong>{money(invoice.refunded_amount, currency)}</strong></div>
      <div><span>Outstanding</span><strong>{money(invoice.due_amount, currency)}</strong></div>
      <div><span>Status</span><Status value={invoice.status} /></div>
    </div>
    {Number(invoice.due_amount || 0) > 0 ? <div className="finance-drawer-actions"><button onClick={() => onAction('discount', invoice)}>Apply discount</button><button onClick={() => onAction('waiver', invoice)}>Waive due</button></div> : null}
    {loading ? <div className="finance-empty">Loading invoice history…</div> : <>
      <section className="finance-history"><h4>Payments and refunds</h4>{history.payments.length ? history.payments.map((row) => <article key={row.id}><div><strong>{money(row.amount, currency)}</strong><Status value={row.status} /></div><p>{row.payment_method || 'Other'} · {titleCase(row.payment_category)} · {dateTime(row.created_at)}</p><small>{row.notes || 'No note'} · {row.collector?.name || 'Clinic staff'}</small><div className="finance-inline-actions">{['active', 'corrected'].includes(row.status) && Number(row.amount) > 0 ? <><button onClick={() => onAction('correct', row)}>Correct</button><button onClick={() => onAction('refund', row)}>Refund</button><button className="danger-link" onClick={() => onAction('void', row)}>Void</button></> : null}{row.status === 'refund' ? <button className="danger-link" onClick={() => onAction('void', row)}>Void refund</button> : null}</div></article>) : <p className="finance-muted">No payment entries.</p>}</section>
      <section className="finance-history"><h4>Adjustment ledger</h4>{history.adjustments.length ? history.adjustments.map((row) => <article key={row.id}><div><strong>{titleCase(row.adjustment_type)}</strong><span>{money(row.amount, currency)}</span></div><p>{row.reason}</p><small>{row.changedBy?.name || 'Clinic owner'} · {dateTime(row.created_at)}</small></article>) : <p className="finance-muted">No adjustments recorded.</p>}</section>
      <section className="finance-history"><h4>Invoice versions</h4>{history.versions.map((row) => <article key={row.id}><div><strong>Version {row.version_number}</strong><span>{titleCase(row.change_type)}</span></div><p>Net {money(row.snapshot?.total_amount, currency)} · Paid {money(row.snapshot?.paid_amount, currency)} · Due {money(row.snapshot?.due_amount, currency)}</p><small>{row.reason} · {dateTime(row.created_at)}</small></article>)}</section>
    </>}
  </aside>;
}

export default function FinanceAdmin({ profile, monthStart, monthEnd, currency = 'INR', onChanged }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('payments');
  const [search, setSearch] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [history, setHistory] = useState(emptyHistory);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [action, setAction] = useState(null);

  async function load() {
    if (!profile || !monthStart || !monthEnd) return;
    setLoading(true); setError('');
    try { setData(await loadFinancialAdmin(profile, monthStart, monthEnd)); }
    catch (err) { setError(err?.message || 'Unable to load financial administration.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [profile?.id, monthStart, monthEnd]);

  async function openInvoice(invoice) {
    setSelectedInvoice(invoice); setHistory(emptyHistory); setHistoryLoading(true);
    try { setHistory(await loadInvoiceFinancialHistory(profile, invoice.id)); }
    catch (err) { setError(err?.message || 'Unable to load invoice history.'); }
    finally { setHistoryLoading(false); }
  }

  async function saved(message) {
    setAction(null); setSelectedInvoice(null); setSuccess(message);
    await load();
    if (onChanged) await onChanged();
  }

  const query = search.trim().toLowerCase();
  const filteredPayments = data.payments.filter((row) => !query || [row.patient?.name, row.patient?.phone, row.patient?.patient_code, row.payment_method, row.payment_category, row.status, row.id].some((value) => String(value || '').toLowerCase().includes(query)));
  const filteredInvoices = data.invoices.filter((row) => {
    const matches = !query || [row.patient?.name, row.patient?.phone, row.patient?.patient_code, row.status, row.payment_category, row.id].some((value) => String(value || '').toLowerCase().includes(query));
    return matches && (invoiceFilter === 'all' || (invoiceFilter === 'open' ? Number(row.due_amount) > 0 : row.status === 'paid'));
  });
  const filteredAdjustments = data.adjustments.filter((row) => !query || [row.patient?.name, row.adjustment_type, row.reason, row.changedBy?.name, row.id].some((value) => String(value || '').toLowerCase().includes(query)));

  const metrics = useMemo(() => {
    const monthInvoices = data.invoices.filter((row) => row.created_at >= monthStart && row.created_at <= monthEnd);
    const positive = data.payments.filter((row) => Number(row.amount) > 0).reduce((sum, row) => sum + Number(row.amount), 0);
    const refunds = Math.abs(data.payments.filter((row) => row.status === 'refund').reduce((sum, row) => sum + Number(row.amount), 0));
    const net = data.payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return {
      gross: monthInvoices.reduce((sum, row) => sum + Number(row.original_total_amount || row.total_amount || 0), 0),
      netBilled: monthInvoices.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
      collected: positive,
      refunds,
      net,
      discounts: data.adjustments.filter((row) => row.adjustment_type === 'discount').reduce((sum, row) => sum + Number(row.amount), 0),
      waivers: data.adjustments.filter((row) => row.adjustment_type === 'waiver').reduce((sum, row) => sum + Number(row.amount), 0),
      due: monthInvoices.reduce((sum, row) => sum + Number(row.due_amount || 0), 0),
    };
  }, [data, monthStart, monthEnd]);

  if (loading) return <div className="finance-empty">Loading financial administration…</div>;
  return <div className="finance-admin">
    <div className="finance-heading"><div><h2>Financial administration</h2><p>Correct payments, issue refunds, approve discounts and waivers, and review every invoice version.</p></div><div className="finance-safe">Owner / head doctor only</div></div>
    {error ? <div className="finance-error">{error}</div> : null}
    {success ? <div className="finance-success">{success}<button onClick={() => setSuccess('')}>×</button></div> : null}
    <section className="finance-kpis">
      <article><span>Gross billed</span><strong>{money(metrics.gross, currency)}</strong><small>Before discounts and waivers</small></article>
      <article><span>Net billed</span><strong>{money(metrics.netBilled, currency)}</strong><small>Current invoice value</small></article>
      <article><span>Payments received</span><strong>{money(metrics.collected, currency)}</strong><small>Positive payment entries</small></article>
      <article><span>Refunds</span><strong>{money(metrics.refunds, currency)}</strong><small>Returned to patients</small></article>
      <article><span>Net collection</span><strong>{money(metrics.net, currency)}</strong><small>Payments minus refunds</small></article>
      <article><span>Discounts</span><strong>{money(metrics.discounts, currency)}</strong><small>Approved this month</small></article>
      <article><span>Waivers</span><strong>{money(metrics.waivers, currency)}</strong><small>Outstanding balance removed</small></article>
      <article><span>Month invoice dues</span><strong>{money(metrics.due, currency)}</strong><small>Current pending amount</small></article>
    </section>
    <section className="finance-chart-panel"><div><h3>Daily net collections</h3><p>Refunds appear as negative activity on the day they are issued.</p></div><DailyCollections payments={data.payments} monthStart={monthStart} currency={currency} /></section>
    <section className="finance-panel">
      <div className="finance-toolbar"><div className="finance-tabs"><button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>Payments <span>{data.payments.length}</span></button><button className={tab === 'invoices' ? 'active' : ''} onClick={() => setTab('invoices')}>Invoices <span>{data.invoices.length}</span></button><button className={tab === 'adjustments' ? 'active' : ''} onClick={() => setTab('adjustments')}>Adjustments <span>{data.adjustments.length}</span></button></div><div className="finance-filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, phone, ID or reason" />{tab === 'invoices' ? <select value={invoiceFilter} onChange={(event) => setInvoiceFilter(event.target.value)}><option value="all">All invoices</option><option value="open">Outstanding</option><option value="paid">Paid</option></select> : null}</div></div>
      {tab === 'payments' ? <div className="finance-table-wrap"><table><thead><tr><th>Date</th><th>Patient</th><th>Amount</th><th>Method</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredPayments.map((row) => <tr key={row.id}><td>{dateTime(row.created_at)}</td><td><strong>{row.patient?.name || 'Unknown'}</strong><small>{row.patient?.phone || row.patient?.patient_code || '—'}</small></td><td className={Number(row.amount) < 0 ? 'negative-money' : ''}>{money(row.amount, currency)}</td><td>{row.payment_method || 'Other'}</td><td>{titleCase(row.payment_category)}</td><td><Status value={row.status} /></td><td><div className="finance-row-actions">{['active', 'corrected'].includes(row.status) && Number(row.amount) > 0 ? <><button onClick={() => setAction({ type: 'correct', target: row })}>Correct</button><button onClick={() => setAction({ type: 'refund', target: row })}>Refund</button><button className="danger-link" onClick={() => setAction({ type: 'void', target: row })}>Void</button></> : null}{row.status === 'refund' ? <button className="danger-link" onClick={() => setAction({ type: 'void', target: row })}>Void refund</button> : null}<button onClick={() => { const invoice = data.invoices.find((item) => item.id === row.invoice_id); if (invoice) openInvoice(invoice); }}>Invoice</button></div></td></tr>)}</tbody></table>{!filteredPayments.length ? <div className="finance-empty">No payment entries match this month and filter.</div> : null}</div> : null}
      {tab === 'invoices' ? <div className="finance-table-wrap"><table><thead><tr><th>Date</th><th>Patient</th><th>Original</th><th>Discount</th><th>Waiver</th><th>Net total</th><th>Paid</th><th>Due</th><th>Status</th></tr></thead><tbody>{filteredInvoices.map((row) => <tr className="clickable" key={row.id} onClick={() => openInvoice(row)}><td>{dateTime(row.created_at)}</td><td><strong>{row.patient?.name || 'Unknown'}</strong><small>{row.patient?.patient_code || row.patient?.phone || '—'}</small></td><td>{money(row.original_total_amount, currency)}</td><td>{money(row.discount_amount, currency)}</td><td>{money(row.waived_amount, currency)}</td><td>{money(row.total_amount, currency)}</td><td>{money(row.paid_amount, currency)}</td><td>{money(row.due_amount, currency)}</td><td><Status value={row.status} /></td></tr>)}</tbody></table>{!filteredInvoices.length ? <div className="finance-empty">No invoices match this filter.</div> : null}</div> : null}
      {tab === 'adjustments' ? <div className="finance-table-wrap"><table><thead><tr><th>Date</th><th>Patient</th><th>Action</th><th>Amount</th><th>Reason</th><th>Changed by</th></tr></thead><tbody>{filteredAdjustments.map((row) => <tr className="clickable" key={row.id} onClick={() => { const invoice = data.invoices.find((item) => item.id === row.invoice_id); if (invoice) openInvoice(invoice); }}><td>{dateTime(row.created_at)}</td><td>{row.patient?.name || 'Unknown'}</td><td>{titleCase(row.adjustment_type)}</td><td>{money(row.amount, currency)}</td><td>{row.reason}</td><td>{row.changedBy?.name || 'Clinic owner'}</td></tr>)}</tbody></table>{!filteredAdjustments.length ? <div className="finance-empty">No financial adjustments were recorded in this month.</div> : null}</div> : null}
    </section>
    {selectedInvoice ? <><div className="finance-drawer-backdrop" onClick={() => setSelectedInvoice(null)} /><InvoiceDrawer invoice={selectedInvoice} history={history} loading={historyLoading} currency={currency} onClose={() => setSelectedInvoice(null)} onAction={(type, target) => setAction({ type, target: { ...target, patient: selectedInvoice.patient } })} /></> : null}
    {action ? <AdjustmentModal action={action} currency={currency} onClose={() => setAction(null)} onSaved={saved} /> : null}
  </div>;
}
