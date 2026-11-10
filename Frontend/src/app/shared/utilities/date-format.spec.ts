import {
  factoryDateKey,
  formatFactoryDate,
  formatFactoryDateTime,
  factoryDayStart,
  factoryMidnight,
  fromPickerDate,
  isInvalidPickerDate,
} from '@shared/utilities/date-format';

describe('factory date formatting (Asia/Dhaka)', () => {
  it('rolls a late-UTC instant over to the next factory day', () => {
    expect(formatFactoryDateTime('2026-10-04T18:30:00Z')).toBe('05/10/2026 12:30 AM');
    expect(formatFactoryDate('2026-10-04T18:30:00Z')).toBe('05/10/2026');
    expect(factoryDateKey('2026-10-04T18:30:00Z')).toBe('2026-10-05');
  });

  it('formats Laravel microsecond ISO and afternoon times', () => {
    expect(formatFactoryDateTime('2026-10-04T09:34:34.000000Z')).toBe('04/10/2026 03:34 PM');
  });

  it('keeps a bare calendar date unshifted and formatting idempotent', () => {
    expect(formatFactoryDate('2026-10-04')).toBe('04/10/2026');
    expect(formatFactoryDate('13/10/2026')).toBe('13/10/2026');
  });

  it('reads a zone-less MySQL timestamp as UTC', () => {
    expect(formatFactoryDateTime('2026-10-04 09:34:34')).toBe('04/10/2026 03:34 PM');
  });

  it('returns empty text for missing or invalid input', () => {
    expect(formatFactoryDate(null)).toBe('');
    expect(formatFactoryDateTime(undefined)).toBe('');
    expect(formatFactoryDateTime('not a date')).toBe('');
  });

  it('converts picker values back to API dates', () => {
    expect(fromPickerDate('05/10/2026')).toBe('2026-10-05');
    expect(fromPickerDate('')).toBe('');
    expect(fromPickerDate('2026-10-05')).toBe('');
    expect(isInvalidPickerDate('')).toBeFalse();
    expect(isInvalidPickerDate('31/02/2026')).toBeTrue();
    expect(isInvalidPickerDate('abc')).toBeTrue();
  });

  it('finds factory midnight for a date and for an instant', () => {
    expect(factoryMidnight('2026-10-08').toISOString()).toBe('2026-10-07T18:00:00.000Z');
    expect(factoryDayStart(Date.parse('2026-10-08T17:59:59Z')).toISOString()).toBe('2026-10-07T18:00:00.000Z');
    expect(factoryDayStart(Date.parse('2026-10-08T18:00:00Z')).toISOString()).toBe('2026-10-08T18:00:00.000Z');
  });
});
