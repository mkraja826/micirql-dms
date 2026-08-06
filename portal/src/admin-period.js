const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const formatDate = (value, options) => new Intl.DateTimeFormat('en-IN', options).format(value);

export const PERIOD_MODES = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

export function periodBounds(mode = 'monthly', anchorValue = new Date()) {
  const anchor = startOfDay(anchorValue);
  let start;
  let end;
  let previousStart;
  let previousEnd;
  let label;

  if (mode === 'daily') {
    start = startOfDay(anchor);
    end = endOfDay(anchor);
    previousStart = new Date(start.getTime() - DAY_MS);
    previousEnd = endOfDay(previousStart);
    label = formatDate(start, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  } else if (mode === 'weekly') {
    const mondayOffset = (anchor.getDay() + 6) % 7;
    start = startOfDay(new Date(anchor.getTime() - mondayOffset * DAY_MS));
    end = endOfDay(new Date(start.getTime() + 6 * DAY_MS));
    previousStart = startOfDay(new Date(start.getTime() - 7 * DAY_MS));
    previousEnd = endOfDay(new Date(previousStart.getTime() + 6 * DAY_MS));
    label = `${formatDate(start, { day: '2-digit', month: 'short' })} – ${formatDate(end, { day: '2-digit', month: 'short', year: 'numeric' })}`;
  } else {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
    previousStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1, 0, 0, 0, 0);
    previousEnd = new Date(anchor.getFullYear(), anchor.getMonth(), 0, 23, 59, 59, 999);
    label = formatDate(start, { month: 'long', year: 'numeric' });
  }

  const result = {
    mode,
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: previousEnd.toISOString(),
  };
  if (typeof globalThis !== 'undefined') globalThis.__capdentOwnerPeriod = result;
  return result;
}

export function shiftPeriod(mode, anchorValue, direction) {
  const anchor = startOfDay(anchorValue);
  if (mode === 'daily') anchor.setDate(anchor.getDate() + direction);
  else if (mode === 'weekly') anchor.setDate(anchor.getDate() + direction * 7);
  else anchor.setMonth(anchor.getMonth() + direction, 1);
  return anchor;
}

export function periodInputValue(mode, anchorValue) {
  const anchor = startOfDay(anchorValue);
  const local = new Date(anchor.getTime() - anchor.getTimezoneOffset() * 60000);
  return mode === 'monthly' ? local.toISOString().slice(0, 7) : local.toISOString().slice(0, 10);
}

export function parsePeriodInput(mode, value) {
  if (!value) return new Date();
  if (mode === 'monthly') {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isCurrentOrFuturePeriod(mode, anchorValue) {
  const current = periodBounds(mode, new Date());
  const selected = periodBounds(mode, anchorValue);
  return new Date(selected.end).getTime() >= new Date(current.end).getTime();
}

export function periodNoun(mode) {
  return mode === 'daily' ? 'day' : mode === 'weekly' ? 'week' : 'month';
}
