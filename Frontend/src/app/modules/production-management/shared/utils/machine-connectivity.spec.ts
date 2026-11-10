import { COMMS_STALE_MS, connectivityOf } from '@production-module/shared/utils/machine-connectivity';

describe('connectivityOf', () => {
  const now = 1_800_000_000_000;

  it('is unknown before any PLC reading arrived', () => {
    expect(connectivityOf(null, now)).toBe('unknown');
  });

  it('is online while the last reading is within the staleness window', () => {
    expect(connectivityOf(now, now)).toBe('online');
    expect(connectivityOf(now - COMMS_STALE_MS, now)).toBe('online');
  });

  it('is stale once the last reading is older than the window', () => {
    expect(connectivityOf(now - COMMS_STALE_MS - 1, now)).toBe('stale');
  });
});
