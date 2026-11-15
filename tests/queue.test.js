import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { todayKey, addDays, weekStart, range, groupByDay, uniqueRecent } from '../js/queue.js';
import { STRINGS } from '../js/i18n.js';

describe('dates', () => {
  it('todayKey uses the device date', () => {
    assert.equal(todayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  });
  it('addDays crosses months, years and the DST change', () => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-28', 2), '2026-03-30');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });
  it('weeks start on Monday', () => {
    assert.equal(weekStart('2026-11-15'), '2026-11-09');   // Sunday
    assert.equal(weekStart('2026-11-16'), '2026-11-16');   // Monday
    assert.equal(weekStart('2026-11-21'), '2026-11-16');   // Saturday
  });
  it('range covers one day or seven', () => {
    assert.deepEqual(range('day', '2026-11-15'), { from: '2026-11-15', to: '2026-11-15' });
    assert.deepEqual(range('week', '2026-11-15'), { from: '2026-11-09', to: '2026-11-15' });
  });
});

describe('groupByDay', () => {
  const rows = [
    { id: 1, day: '2026-11-16', start_time: null, created_at: '2026-11-01T08:00:00Z' },
    { id: 2, day: '2026-11-16', start_time: '14:00:00', created_at: '2026-11-01T09:00:00Z' },
    { id: 3, day: '2026-11-16', start_time: '09:30:00', created_at: '2026-11-01T10:00:00Z' },
    { id: 4, day: '2026-11-16', start_time: null, created_at: '2026-11-01T07:00:00Z' },
    { id: 5, day: '2026-11-18', start_time: '10:00:00', created_at: '2026-11-01T07:00:00Z' },
    { id: 6, day: '2026-12-01', start_time: '10:00:00', created_at: '2026-11-01T07:00:00Z' }
  ];
  it('returns every day in range, timed first, untimed in the order taken', () => {
    const days = groupByDay(rows, '2026-11-16', '2026-11-22');
    assert.equal(days.length, 7);
    assert.deepEqual(days[0].items.map(r => r.id), [3, 2, 4, 1]);
    assert.deepEqual(days[1].items, []);
    assert.deepEqual(days[2].items.map(r => r.id), [5]);
    assert.ok(!days.flatMap(d => d.items).some(r => r.id === 6), 'out-of-range row ignored');
  });
});

describe('uniqueRecent', () => {
  it('dedupes case-insensitively, keeps the first spelling, drops blanks', () => {
    assert.deepEqual(uniqueRecent(['Hall B', ' hall b', '', null, 'Gym', 'HALL B']), ['Hall B', 'Gym']);
    assert.equal(uniqueRecent(['a', 'b', 'c'], 2).length, 2);
  });
});

describe('i18n', () => {
  it('every string has English and Arabic', () => {
    for (const [key, pair] of Object.entries(STRINGS)) {
      assert.equal(pair.length, 2, key);
      assert.ok(pair.every(s => typeof s === 'string' && s.trim()), key);
    }
  });
});
