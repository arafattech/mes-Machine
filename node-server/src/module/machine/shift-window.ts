import moment from 'moment';

/**
 * A shift's real datetime window for one specific calendar day — time-of-day only, the
 * shift row's own stored date is irrelevant. Shift times are naive factory wall-clock values
 * that Prisma hands back as UTC-based Dates, so they are read with `moment.utc` (same as
 * biometrics) and placed in the process zone, which `factory-timezone.ts` pins to the factory zone.
 * A shift ending at or before its start runs overnight into the next day.
 */
export function shiftWindowForDay(
  shift: { start_time: Date; end_time: Date },
  day: moment.Moment,
): [moment.Moment, moment.Moment] {
  const dayStr = day.format('YYYY-MM-DD');
  const start = moment(`${dayStr} ${moment.utc(shift.start_time).format('HH:mm:ss')}`);
  const end = moment(`${dayStr} ${moment.utc(shift.end_time).format('HH:mm:ss')}`);
  if (end.isSameOrBefore(start)) {
    end.add(1, 'day');
  }
  return [start, end];
}
