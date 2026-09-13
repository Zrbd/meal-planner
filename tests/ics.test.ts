import { describe, expect, it } from 'vitest';
import { buildICS, reminderEvents } from '../src/domain/ics';
import { ingById, lot, meal, recipesById } from './helpers';

const today = '2026-09-13';

describe('calendar reminders', () => {
  it('creates cook, use-by and shopping events with alarms', () => {
    const events = reminderEvents({
      meals: [meal('test-curry', '2026-09-15')],
      recipesById,
      ingById,
      lots: [lot('spinach', 100, { expiresOn: '2026-09-16' })],
      loose: [],
      today,
      shoppingDay: 3,
    });
    const titles = events.map((e) => e.title).join('\n');
    expect(titles).toMatch(/🍳/);
    expect(titles).toMatch(/use your (baby )?spinach by tomorrow/i);
    expect(titles).toMatch(/shopping day/i);
    const ics = buildICS(events, Date.UTC(2026, 8, 13));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20260915T170000');
    expect(ics.match(/BEGIN:VALARM/g)?.length).toBe(events.length);
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
  });

  it('skips cooked, past and leftover meals', () => {
    const events = reminderEvents({
      meals: [meal('test-curry', '2026-09-10'), meal('test-curry', '2026-09-14', { status: 'cooked' })],
      recipesById, ingById, lots: [], loose: [], today, shoppingDay: 6, days: 3,
    });
    expect(events.filter((e) => e.uid.startsWith('cook'))).toHaveLength(0);
  });
});
