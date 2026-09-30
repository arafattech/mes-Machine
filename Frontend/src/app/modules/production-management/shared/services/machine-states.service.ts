import { Injectable, signal } from '@angular/core';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { MachineState } from '@app/shared/model/machineState';

const FALLBACK_COLOR = '#6a6d70';
const FALLBACK_ICON = 'question-mark';

/** Fixed display order for the canonical states — any other (new/custom) state is
 * appended after these, in priority order. Display order only; `priority` (from the
 * DB) is what actually drives channel-mapping resolution, unrelated to this list. */
const CANONICAL_ORDER = ['active', 'idle', 'maintenance', 'inactive', 'fault'];

/**
 * Single source of truth for machine status name/color/icon/productive-flag —
 * replaces the hardcoded ACTIVE/IDLE/INACTIVE/MAINTENANCE/FAULT palettes that used
 * to be duplicated across ~8 components. Backed by the admin-editable `machine_states`
 * table; loaded once and cached for the app's lifetime (states rarely change, and every
 * consumer needing them is already inside an authenticated session).
 */
@Injectable({ providedIn: 'root' })
export class MachineStatesService {
  private readonly statesById = signal<Map<number, MachineState>>(new Map());
  private readonly statesByName = signal<Map<string, MachineState>>(new Map());
  private states$?: Observable<MachineState[]>;

  constructor(private commonService: CommonService) {}

  /** Triggers the (cached, one-time) load. Subscribe once per app, e.g. in APP_INITIALIZER
   * or the first component that needs states — subsequent calls replay the same result. */
  loadAll(): Observable<MachineState[]> {
    if (!this.states$) {
      this.states$ = this.commonService
        .get<{ value?: unknown[] }>('MachineStates?$filter=is_active eq true', true)
        .pipe(
          map((res) => (res?.value ?? []).map((s) => new MachineState().deserialize(s))),
          tap((states) => {
            this.statesById.set(new Map(states.map((s) => [s.id as number, s])));
            // First occurrence wins on a (rare, admin-caused) duplicate name — matches the
            // old linear `find()`'s semantics exactly.
            const byName = new Map<string, MachineState>();
            for (const s of states) {
              const key = (s.name ?? '').toLowerCase();
              if (!byName.has(key)) byName.set(key, s);
            }
            this.statesByName.set(byName);
          }),
          shareReplay(1),
        );
    }
    return this.states$;
  }

  /** Drops the cached observable and re-fetches — call after any create/edit/delete on
   * `machine_states` (see `MachineStateListComponent.processData()`) so already-running
   * consumers (board tiles, status cards, etc., all reading the shared signals below) pick
   * up the change immediately instead of showing whatever was cached at app start. */
  refresh(): Observable<MachineState[]> {
    this.states$ = undefined;
    return this.loadAll();
  }

  /** All loaded states — Active/Idle/Maintenance/Inactive/Fault always first in that
   * fixed order; any other state (newly added via the API) appended after, by priority.
   * Empty until `loadAll()` resolves. */
  getAll(): MachineState[] {
    const rank = (s: MachineState): number => {
      const i = CANONICAL_ORDER.indexOf(s.name?.toLowerCase() ?? '');
      return i === -1 ? CANONICAL_ORDER.length : i;
    };
    return [...this.statesById().values()].sort((a, b) => {
      const diff = rank(a) - rank(b);
      return diff !== 0 ? diff : (b.priority ?? 0) - (a.priority ?? 0);
    });
  }

  getState(machineStateId: number | null | undefined): MachineState | undefined {
    return machineStateId != null ? this.statesById().get(machineStateId) : undefined;
  }

  /** Case-insensitive name lookup — for telemetry paths (socket broadcasts, legacy worker
   * mode) that only carry a state's name string, not its numeric id. O(1) — called once
   * per machine per tick from board/card components. */
  getByName(name: string | null | undefined): MachineState | undefined {
    if (!name) return undefined;
    return this.statesByName().get(name.toLowerCase());
  }

  getColor(machineStateId: number | null | undefined): string {
    return this.getState(machineStateId)?.color ?? FALLBACK_COLOR;
  }

  getIcon(machineStateId: number | null | undefined): string {
    return this.getState(machineStateId)?.icon ?? FALLBACK_ICON;
  }

  /** Pastel background tint derived from the state's own color — replaces the separate
   * hardcoded tint maps every consumer used to keep alongside a color map. Mixes toward
   * the theme's own tile surface (not a literal `white`) so the tint stays legible and
   * on-theme in dark UI5 themes instead of rendering as a near-white pill. */
  getTint(machineStateId: number | null | undefined): string {
    return `color-mix(in srgb, ${this.getColor(machineStateId)} 12%, var(--sapTile_Background, #fff))`;
  }

  getLabel(machineStateId: number | null | undefined): string {
    return this.getState(machineStateId)?.name ?? $localize`Unknown`;
  }

  /** `machine_states.id` set that counts toward OEE Availability — for client-side
   * calculations that need it (most Availability figures come pre-computed from the API). */
  getProductiveIds(): Set<number> {
    return new Set(
      [...this.statesById().values()]
        .filter((s) => s.counts_as_productive)
        .map((s) => s.id as number),
    );
  }
}
