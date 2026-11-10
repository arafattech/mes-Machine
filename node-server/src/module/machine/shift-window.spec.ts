import moment from 'moment';
import { shiftWindowForDay } from './shift-window';

describe('shiftWindowForDay', () => {
  const originalTz = process.env.TZ;
  beforeAll(() => (process.env.TZ = 'Asia/Dhaka'));
  afterAll(() => (process.env.TZ = originalTz));

  it('reads naive shift wall-clock as factory time', () => {
    const shift = { start_time: new Date('2026-10-01T12:50:00Z'), end_time: new Date('2026-10-01T18:50:00Z') };

    const [start, end] = shiftWindowForDay(shift, moment('2026-10-04'));

    expect(start.toISOString()).toBe('2026-10-04T06:50:00.000Z');
    expect(end.toISOString()).toBe('2026-10-04T12:50:00.000Z');
  });

  it('rolls an overnight shift into the next day', () => {
    const shift = { start_time: new Date('2026-10-01T22:00:00Z'), end_time: new Date('2026-10-01T06:00:00Z') };

    const [start, end] = shiftWindowForDay(shift, moment('2026-10-04'));

    expect(start.toISOString()).toBe('2026-10-04T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });
});
