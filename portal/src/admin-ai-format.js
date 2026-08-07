function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function dateValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function inclusiveDays(start, end) {
  const startMs = dateValue(start);
  const endMs = dateValue(end);
  if (startMs == null || endMs == null || endMs < startMs) return 1;
  return Math.round((endMs - startMs) / 86400000) + 1;
}

function formatDate(value) {
  const ms = dateValue(value);
  if (ms == null) return String(value || '');
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(ms));
}

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits }).format(toNumber(value));
}

function formatCurrency(value, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(toNumber(value));
  } catch {
    return `${currency || 'INR'} ${formatNumber(value)}`;
  }
}

function percentChange(current, previous) {
  const before = toNumber(previous);
  const now = toNumber(current);
  if (before === 0) return now === 0 ? 0 : null;
  return ((now - before) / Math.abs(before)) * 100;
}

function changeText(current, previous) {
  const change = percentChange(current, previous);
  if (change == null) return toNumber(current) > 0 ? 'new activity' : 'no change';
  const rounded = Math.round(change);
  if (rounded === 0) return 'about the same';
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function cleanAiText(value) {
  const lines = String(value || '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\|?\s*:?-{3,}/.test(line));

  const cleaned = lines.map((line) => {
    if (!line.includes('|')) return line.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s+/, '• ');
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
    return cells.length ? cells.join(' · ') : '';
  }).filter(Boolean);

  return cleaned.join('\n');
}

function metricLine(label, current, previous, currentDays, previousDays) {
  const currentDaily = toNumber(current) / currentDays;
  const previousDaily = toNumber(previous) / previousDays;
  return `${label}/day: ${formatNumber(currentDaily, 1)} vs ${formatNumber(previousDaily, 1)} (${changeText(currentDaily, previousDaily)})`;
}

function periodRange(summary) {
  const current = `${formatDate(summary.period_start)}–${formatDate(summary.period_end)}`;
  const previous = `${formatDate(summary.previous_start)}–${formatDate(summary.previous_end)}`;
  return { current, previous };
}

function formatDailyComparison(summary) {
  const currentDays = inclusiveDays(summary.period_start, summary.period_end);
  const previousDays = inclusiveDays(summary.previous_start, summary.previous_end);
  const range = periodRange(summary);
  const currency = summary.currency_code || 'INR';
  const lines = [
    `Daily performance: ${range.current} vs ${range.previous}`,
    metricLine('Patients', summary.patients_count, summary.previous_patients_count, currentDays, previousDays),
    metricLine('New patients', summary.new_patients_count, summary.previous_new_patients_count, currentDays, previousDays),
    metricLine('Appointments', summary.appointments_count, summary.previous_appointments_count, currentDays, previousDays),
    metricLine('Completed', summary.completed_count, summary.previous_completed_count, currentDays, previousDays),
    metricLine('Visits', summary.visits_count, summary.previous_visits_count, currentDays, previousDays),
  ];

  if (summary.can_view_finance !== false && summary.net_collections != null) {
    const currentCollections = toNumber(summary.net_collections) / currentDays;
    const previousCollections = toNumber(summary.previous_net_collections) / previousDays;
    lines.push(`Collections/day: ${formatCurrency(currentCollections, currency)} vs ${formatCurrency(previousCollections, currency)} (${changeText(currentCollections, previousCollections)})`);
  }

  return lines.join('\n');
}

function formatPeriodComparison(summary) {
  const range = periodRange(summary);
  const currency = summary.currency_code || 'INR';
  const lines = [
    `Comparison: ${range.current} vs ${range.previous}`,
    `Patients: ${formatNumber(summary.patients_count)} vs ${formatNumber(summary.previous_patients_count)} (${changeText(summary.patients_count, summary.previous_patients_count)})`,
    `Appointments: ${formatNumber(summary.appointments_count)} vs ${formatNumber(summary.previous_appointments_count)} (${changeText(summary.appointments_count, summary.previous_appointments_count)})`,
    `Completed: ${formatNumber(summary.completed_count)} vs ${formatNumber(summary.previous_completed_count)} (${changeText(summary.completed_count, summary.previous_completed_count)})`,
    `Visits: ${formatNumber(summary.visits_count)} vs ${formatNumber(summary.previous_visits_count)} (${changeText(summary.visits_count, summary.previous_visits_count)})`,
  ];

  if (summary.can_view_finance !== false && summary.net_collections != null) {
    lines.push(`Net collections: ${formatCurrency(summary.net_collections, currency)} vs ${formatCurrency(summary.previous_net_collections, currency)} (${changeText(summary.net_collections, summary.previous_net_collections)})`);
  }

  return lines.join('\n');
}

function formatToday(summary) {
  const currency = summary.currency_code || 'INR';
  const lines = [
    `Today: ${formatNumber(summary.patients_today)} patients, ${formatNumber(summary.appointments_today)} appointments and ${formatNumber(summary.visits_today)} recorded visits.`,
    `Waiting now: ${formatNumber(summary.waiting_count)} · Completed: ${formatNumber(summary.completed_count)} · New patients: ${formatNumber(summary.new_patients_today)}`,
  ];
  if (summary.can_view_finance !== false && summary.net_collections_today != null) {
    lines.push(`Net collections: ${formatCurrency(summary.net_collections_today, currency)} · Outstanding dues: ${formatCurrency(summary.outstanding_dues, currency)}`);
  }
  return lines.join('\n');
}

export function formatClinicAiReply(question, payload) {
  const summary = payload?.summary;
  if (!summary || typeof summary !== 'object') return cleanAiText(payload?.answer);

  const q = String(question || '').toLowerCase();
  const currency = summary.currency_code || 'INR';

  if (/outstanding|pending\s+dues?|how much.*due/.test(q)) {
    const dues = summary.outstanding_dues_now ?? summary.outstanding_dues;
    if (dues != null && summary.can_view_finance !== false) {
      return `Current outstanding dues: ${formatCurrency(dues, currency)}.\nThis is the clinic's current lifetime outstanding balance.`;
    }
  }

  if (/tomorrow/.test(q) && /appointment/.test(q) && payload.period === 'tomorrow') {
    return `Tomorrow's appointments: ${formatNumber(summary.appointments_count)}.\nFor comparison, today has ${formatNumber(summary.previous_appointments_count)} appointments in the same metric.`;
  }

  if (/collection/.test(q) && payload.period === 'daily' && summary.net_collections_today != null) {
    return `Today's net collections: ${formatCurrency(summary.net_collections_today, currency)}.\nCurrent outstanding dues: ${formatCurrency(summary.outstanding_dues, currency)}.`;
  }

  if (payload.period === 'daily' && /today|clinic doing|performance/.test(q)) {
    return formatToday(summary);
  }

  if ((payload.period === 'weekly' || payload.period === 'monthly') && /daily|per day|average/.test(q)) {
    return formatDailyComparison(summary);
  }

  if ((payload.period === 'weekly' || payload.period === 'monthly') && /compare|comparison|last week|last month|versus|\bvs\b/.test(q)) {
    return formatPeriodComparison(summary);
  }

  return cleanAiText(payload?.answer);
}
