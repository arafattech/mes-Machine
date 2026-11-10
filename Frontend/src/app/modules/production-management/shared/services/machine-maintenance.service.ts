import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { DEFAULT_BUFFER_MINUTES } from '@production-module/shared/utils/maintenance-buffer';

/**
 * Machine-maintenance scheduling — write-side REST client for the
 * MachineMaintenance CRUD page. Reads are NOT done here: the list page's AG Grid
 * table reads `GET /api/machine/maintenance` directly (REST, `type: 'api'`
 * datasource) via `MachineMaintenanceController::index()`.
 *
 * The override effect is applied by node-server from the Redis override set —
 * Laravel persists the row, node-server forces MAINTENANCE state. `delete()` and
 * `end()` clear the override so a machine is never stuck in MAINTENANCE.
 */
@Injectable({ providedIn: 'root' })
export class MachineMaintenanceService {
  constructor(private readonly commonService: CommonService) {}

  /** Create a schedule. Always created SCHEDULED — activation is manual-only ("Activate now"), never automatic. */
  create(
    machineId: number,
    scheduledStartAt: string,
    reason: string,
    bufferEnabled = true,
    bufferMinutes = DEFAULT_BUFFER_MINUTES,
  ): Observable<unknown> {
    return this.commonService.post(
      'machine/maintenance',
      {
        machine_id: machineId,
        scheduled_start_at: scheduledStartAt,
        reason,
        buffer_enabled: bufferEnabled,
        buffer_minutes: bufferMinutes,
      },
      false,
    );
  }

  /**
   * Update a schedule. While SCHEDULED, machine / start time / reason are all
   * editable; once ACTIVE only `reason` (and `buffer_enabled` / `buffer_minutes`, always
   * editable regardless of state) are accepted by the backend. Send the field(s) to
   * change — nulls are ignored by the backend.
   */
  update(
    id: number,
    payload: {
      machine_id?: number;
      scheduled_start_at?: string;
      reason?: string;
      buffer_enabled?: boolean;
      buffer_minutes?: number;
    },
  ): Observable<unknown> {
    return this.commonService.put(`machine/maintenance/${id}`, payload, false);
  }

  /** Delete a schedule (clears the override if it was ACTIVE). */
  remove(id: number): Observable<unknown> {
    return this.commonService.delete(`machine/maintenance/${id}`, undefined, false);
  }

  /** End an ACTIVE schedule or cancel a SCHEDULED one (same endpoint). */
  end(machineId: number, maintenanceNote?: string): Observable<unknown> {
    return this.commonService.post(`machine/${machineId}/maintenance/end`, { maintenance_note: maintenanceNote }, false);
  }

  /** Activate a single SCHEDULED row on demand. */
  activate(id: number): Observable<unknown> {
    return this.commonService.post(`machine/maintenance/${id}/activate`, {}, false);
  }
}