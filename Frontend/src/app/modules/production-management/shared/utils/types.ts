export type MachineData = {
  machine_name: string;
  active: boolean;
  tempC?: number | null;
  hours: number;
};

/** An admin-defined `machine_states.name`, uppercased for display — not a fixed 5-value
 * set. Channel-mapping mode broadcasts whatever name the admin gave the state; only the
 * legacy 2-flag worker path still falls back to a hardcoded 3-value subset (see `deriveActivity`). */
export type MachineActivityType = string;

export type MetricIcon = 'box' | 'cog' | 'sparkles' | 'wrench';

export type MetricColor = 'green' | 'purple' | 'orange' | 'rose';

export type Accent = 'purple' | 'teal' | 'amber' | 'rose'; 

export type DateHours = { date: Date; hoursRun: number };
