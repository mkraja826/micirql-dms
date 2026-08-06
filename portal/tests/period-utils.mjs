import assert from 'node:assert/strict';
import { periodBounds, shiftPeriod } from '../src/admin-period.js';

const dateParts = (value) => {
  const date = new Date(value);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
};

const daily = periodBounds('daily', new Date(2026, 7, 7, 14, 30));
assert.deepEqual(dateParts(daily.start), [2026, 8, 7, 0, 0]);
assert.deepEqual(dateParts(daily.end), [2026, 8, 7, 23, 59]);
assert.deepEqual(dateParts(daily.previousStart), [2026, 8, 6, 0, 0]);

const weekly = periodBounds('weekly', new Date(2026, 7, 7, 14, 30));
assert.deepEqual(dateParts(weekly.start), [2026, 8, 3, 0, 0]);
assert.deepEqual(dateParts(weekly.end), [2026, 8, 9, 23, 59]);
assert.deepEqual(dateParts(weekly.previousStart), [2026, 7, 27, 0, 0]);

const monthly = periodBounds('monthly', new Date(2026, 7, 7, 14, 30));
assert.deepEqual(dateParts(monthly.start), [2026, 8, 1, 0, 0]);
assert.deepEqual(dateParts(monthly.end), [2026, 8, 31, 23, 59]);
assert.deepEqual(dateParts(monthly.previousStart), [2026, 7, 1, 0, 0]);

assert.deepEqual(dateParts(shiftPeriod('daily', new Date(2026, 7, 7), -1)).slice(0, 3), [2026, 8, 6]);
assert.deepEqual(dateParts(shiftPeriod('weekly', new Date(2026, 7, 7), -1)).slice(0, 3), [2026, 7, 31]);
assert.deepEqual(dateParts(shiftPeriod('monthly', new Date(2026, 7, 7), -1)).slice(0, 3), [2026, 7, 1]);

console.log('Clinic Admin reporting-period boundary tests passed.');
