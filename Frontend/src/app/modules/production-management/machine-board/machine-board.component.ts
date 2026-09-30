import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval } from 'rxjs';
import { StatusCardData } from '@production-module/shared/interface/interface';
import { CommonService } from '@app/services/common-service/common.service';
import { ProductionService } from '@production-module/shared/services/production.service';
import { Machine } from '@app/shared/model/machine';
import { Localization } from '@shared/utilities/localization';
import { ViewMode } from '@production-module/shared//enums/viewMode';
import { Hall } from '@shared/model/hall';
import { SocketService } from '@app/services/socket.service';
import { deriveActivity } from '@production-module/shared/utils/machine-status';
import {
  MachineDurationService,
  MachineDurations,
} from '@production-module/shared/services/machine-duration.service';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';

type SocketMachineData = {
  MNR: string | number;
  P?: number;
  A?: number;
  T?: number;
  S?: number;
  // Present only in channel mapping mode: explicit, pre-derived machine status.
  STATUS?: string;
  // Epoch ms this machine's PLC last actually responded — read by MachineDurationService,
  // not consumed directly here.
  lastSeenAt?: number | null;
};

/** One `results` row — the raw machine plus everything derived from live telemetry.
 * `Omit<Machine, ...>` rather than `extends Machine`: rows are plain object-spread
 * copies, not `Machine` instances, so they never carry its `deserialize`/`toOdata` methods. */
type MachineBoardResult = Omit<Machine, 'deserialize' | 'toOdata'> & {
  status: string;
  hours: number | null;
  temp: number | null;
  rpm: number | null;
  load: number | null;
  shotCount: number | null;
  durations: MachineDurations;
};

@Component({
  selector: 'app-all-machines',
  templateUrl: './machine-board.component.html',
  styleUrl: './machine-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineBoardComponent implements OnInit {
  public readonly productionService = inject(ProductionService);
  private readonly commonService = inject(CommonService);
  private readonly socketService = inject(SocketService);
  private readonly durationService = inject(MachineDurationService);
  private readonly machineStates = inject(MachineStatesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  public readonly localization = Localization;
  public readonly viewModeEnum = ViewMode;

  public readonly viewType = signal(this.viewModeEnum.COMPACT);
  public readonly machines = signal<Machine[]>([]);
  public readonly halls = signal<Hall[]>([]);
  public readonly results = signal<MachineBoardResult[]>([]);

  /** Denominator for every non-overall tile — always `results().length`. */
  public readonly totalMachines = computed(() => this.results().length);

  /** One tile per active `machine_states` row + the fixed Overall tile — derives from
   * `results` and the live `MachineStatesService` state, so it recomputes the moment
   * either changes (including once `machine_states` finishes loading, with no extra
   * wiring needed). */
  public readonly cards = computed<StatusCardData[]>(() => this.buildCards(this.results()));

  private readonly machineDataMap = new Map<string, SocketMachineData>();

  ngOnInit() {
    this.productionService.machines$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.machines.set(data);
        this.checkStatus(data);
      });

    // Layout's constructor loads machines only once app-wide; re-fetch here so
    // re-entering this page (without a full browser reload) shows current data.
    this.productionService.loadMachines('all-machines');

    this.productionService.hallList$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.halls.set(data));

    this.socketService
      .on('to_frontend')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: SocketMachineData | SocketMachineData[]) => {
        const telemetryList = Array.isArray(data) ? data : [data];
        for (const item of telemetryList) {
          if (item?.MNR != null) {
            this.machineDataMap.set(String(item.MNR), item);
          }
        }
        this.checkStatus(this.machines());
      });

    // Refresh live per-state durations every second.
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshDurations());
  }

  detailsPage(machine: MachineBoardResult) {
    this.router.navigate(['/production/mco'], {
      queryParams: {
        id: machine.custom_id,
        machineId: machine.id,
        name: machine.machine_name,
        status: machine.status,
      },
    });
  }

  // UI5 web-component custom events (e.g. `selection-change`) type as plain `Event` in
  // this project's UI5 Angular wrapper — `event: any` matches every other handler for
  // these events across the codebase, not a typing oversight.
  onSegmentChange(event: any) {
    const selectedValue = event.detail.selectedItems[0].value;

    switch (selectedValue) {
      case 'compact':
        this.viewType.set(this.viewModeEnum.COMPACT);
        this.commonService.sidenavHidden.emit(false);
        break;
      case 'card':
        this.viewType.set(this.viewModeEnum.DETAILED);
        this.commonService.sidenavHidden.emit(false);
        break;
      case 'fullScreen':
        this.viewType.set(this.viewModeEnum.FULL_SCREEN);
        this.commonService.sidenavHidden.emit(true);
        break;
      default:
        break;
    }
  }

  hallChange(event: any) {
    const selectedHall = event.detail.item.value;
    this.productionService.loadMachines(selectedHall);
  }

  trackByMachine = (index: number, machine: MachineBoardResult): string | number =>
    machine?.custom_id ?? machine?.machine_name ?? index;

  trackByCardType = (_: number, card: StatusCardData): string | number => card.type;

  private checkStatus(dataArray: Machine[]): void {
    const rows: MachineBoardResult[] = dataArray.map((machineData) => {
      const liveData = this.getMachineData(machineData);
      const status = this.getMachineStatus(liveData);

      return {
        ...machineData,
        status,
        hours: liveData?.T ?? null,
        temp: liveData?.T ?? null,
        rpm: liveData?.S ?? null,
        load: liveData?.S ?? null,
        shotCount: liveData?.P ?? null,
        durations: this.durationService.snapshot(
          liveData?.MNR != null ? String(liveData.MNR) : null,
        ),
      };
    });
    this.results.set(rows);
  }

  private refreshDurations(): void {
    this.results.update((rows) =>
      rows.map((row) => {
        const liveData = this.getMachineData(row);
        return {
          ...row,
          durations: this.durationService.snapshot(
            liveData?.MNR != null ? String(liveData.MNR) : null,
          ),
        };
      }),
    );
  }

  private buildCards(results: MachineBoardResult[]): StatusCardData[] {
    const total = results.length;

    const countByStateId = new Map<number, number>();
    for (const item of results) {
      const state = this.machineStates.getByName(item.status);
      if (state?.id != null) {
        countByStateId.set(state.id, (countByStateId.get(state.id) ?? 0) + 1);
      }
    }

    const productiveIds = this.machineStates.getProductiveIds();
    const productiveCount = [...countByStateId.entries()]
      .filter(([stateId]) => productiveIds.has(stateId))
      .reduce((sum, [, count]) => sum + count, 0);
    const overallEfficiency = this.toPercent(productiveCount, total);

    const overallCard: StatusCardData = {
      percent: overallEfficiency,
      progress: overallEfficiency,
      counts: total,
      label: $localize`Overall Efficiency`,
      type: 'overall',
    };

    const stateCards: StatusCardData[] = this.machineStates.getAll().map((state) => {
      const count = countByStateId.get(state.id as number) ?? 0;
      return {
        percent: this.toPercent(count, total),
        progress: this.toPercent(count, total),
        counts: count,
        label: $localize`${state.name} Machines`,
        type: state.id as number,
      };
    });

    return [overallCard, ...stateCards];
  }

  private toPercent(count: number, total: number): number {
    if (!total) {
      return 0;
    }
    return Math.round((count / total) * 100);
  }

  private getMachineData(
    machine: Pick<Machine, 'id' | 'custom_id'>,
  ): SocketMachineData | undefined {
    const idKey = machine.id != null ? String(machine.id) : null;
    const customIdKey =
      machine.custom_id != null ? String(machine.custom_id) : null;
    const numericCustomId =
      customIdKey != null ? customIdKey.replace(/\D/g, '') : null;

    return (
      (idKey ? this.machineDataMap.get(idKey) : undefined) ??
      (customIdKey ? this.machineDataMap.get(customIdKey) : undefined) ??
      (numericCustomId ? this.machineDataMap.get(numericCustomId) : undefined)
    );
  }

  private getMachineStatus(data?: SocketMachineData): string {
    return deriveActivity(data);
  }
}
