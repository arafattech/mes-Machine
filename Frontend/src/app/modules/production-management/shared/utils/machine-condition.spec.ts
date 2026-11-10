import { MaintenanceRow, dueText, limitsText, lastMaintenance, sensorStatus, summarizeMaintenance } from '@production-module/shared/utils/machine-condition';

const row = (overrides: Partial<MaintenanceRow>): MaintenanceRow => ({
  id: 1,
  scheduled_start_at: null,
  reason: 'Belt change',
  maintenance_note: null,
  activated_at: null,
  ended_at: null,
  duration_seconds: null,
  ...overrides,
});

describe('machine-condition', () => {
  beforeEach(() => {
    jasmine.clock().install();
    // 13/10/2026 18:00 Asia/Dhaka
    jasmine.clock().mockDate(new Date('2026-10-13T12:00:00Z'));
  });
  afterEach(() => jasmine.clock().uninstall());

  it('prefers a running maintenance over a scheduled one', () => {
    const summary = summarizeMaintenance(
      [
        row({ id: 1, scheduled_start_at: '2026-10-22T19:25:00.000000Z' }),
        row({ id: 2, reason: 'Hydraulic leak', activated_at: '2026-10-13T11:00:00Z' }),
      ],
      true,
    );
    expect(summary.kind).toBe('active');
    expect(summary.kind === 'active' && summary.reason).toBe('Hydraulic leak');
  });

  it('shows the next scheduled maintenance when an open row exists but the machine is not in maintenance', () => {
    const summary = summarizeMaintenance(
      [
        row({ id: 1, scheduled_start_at: '2026-10-22T19:25:00.000000Z', reason: 'Oil' }),
        row({ id: 2, reason: 'Hydraulic leak', activated_at: '2026-10-13T11:00:00Z' }),
      ],
      false,
    );
    expect(summary.kind).toBe('scheduled');
    expect(summary.kind === 'scheduled' && summary.reason).toBe('Oil');
  });

  it('reads scheduled_start_at as naive factory time and picks the soonest', () => {
    const summary = summarizeMaintenance(
      [
        row({ id: 1, scheduled_start_at: '2026-10-22T19:25:00.000000Z' }),
        row({ id: 2, scheduled_start_at: '2026-10-14T08:00:00.000000Z', reason: 'Oil' }),
      ],
      false,
    );
    expect(summary.kind).toBe('scheduled');
    if (summary.kind !== 'scheduled') return;
    expect(summary.reason).toBe('Oil');
    // 14/10 08:00 Dhaka = 14/10 02:00 UTC
    expect(summary.dueMs).toBe(Date.parse('2026-10-14T02:00:00Z'));
    expect(summary.when).toBe('14/10/2026 08:00 AM');
    expect(summary.overdue).toBeFalse();
  });

  it('reports nothing when only finished maintenance exists, and keeps the latest as "last"', () => {
    const rows = [
      row({ id: 1, activated_at: '2026-10-12T07:00:00Z', ended_at: '2026-10-12T08:00:00Z' }),
      row({ id: 2, activated_at: '2026-10-13T06:00:00Z', ended_at: '2026-10-13T06:30:00Z', maintenance_note: 'Done' }),
    ];
    expect(summarizeMaintenance(rows, false).kind).toBe('none');
    expect(lastMaintenance(rows)).toEqual({ reason: 'Done', endedAt: '13/10/2026 12:30 PM', durationSeconds: 1800 });
  });

  it('formats the time until a schedule coarsely', () => {
    const now = Date.now();
    expect(dueText(now + (2 * 1440 + 90) * 60_000, now)).toBe('in 2 d 1 h');
    expect(dueText(now + 75 * 60_000, now)).toBe('in 1 h 15 min');
    expect(dueText(now - 1, now)).toBe('overdue');
  });

  it('classifies sensor readings against optional limits', () => {
    expect(sensorStatus(null, 10, 50)).toBe('unknown');
    expect(sensorStatus(55, 10, 50)).toBe('high');
    expect(sensorStatus(5, 10, 50)).toBe('low');
    expect(sensorStatus(30, null, null)).toBe('normal');
    expect(limitsText(null, null, '°C')).toBe('No limits set');
    expect(limitsText(10, 50, '°C')).toBe('10–50 °C');
  });
});
