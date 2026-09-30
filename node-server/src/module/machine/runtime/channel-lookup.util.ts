/** `inputs[i]` (boolean) → `{ [i]: boolean }` — channel `i` is DI`i`. */
export type ChannelLookup = Record<number, boolean>;

/** One machine's full channel acquisition for one tick — status derivation lookup plus the raw arrays, both DI-index-ordered (0-9). */
export type ChannelAcquisition = {
  lookup: ChannelLookup;
  inputs: boolean[];
  counts: number[];
};

export function buildChannelLookup(inputs: unknown[]): ChannelLookup {
  const lookup: ChannelLookup = {};
  for (let i = 0; i < inputs.length; i++) {
    lookup[i] = Boolean(inputs[i]);
  }
  return lookup;
}

/** `counts[i]` (unknown) → `number[]` — non-finite/missing entries default to 0. */
export function buildChannelCounters(counts: unknown[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < counts.length; i++) {
    const n = Number(counts[i]);
    out.push(Number.isFinite(n) ? n : 0);
  }
  return out;
}

/**
 * Decode DI0..DI9's 32-bit counters from 20 Modbus input registers (FC4),
 * low word first per counter: `counts[i] = registers[2*i] + registers[2*i+1] << 16`.
 */
export function decodeModbusCounters(registers: ArrayLike<number>): number[] {
  const counts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const low = Number(registers[2 * i] ?? 0);
    const high = Number(registers[2 * i + 1] ?? 0);
    counts.push(low + high * 65536);
  }
  return counts;
}
