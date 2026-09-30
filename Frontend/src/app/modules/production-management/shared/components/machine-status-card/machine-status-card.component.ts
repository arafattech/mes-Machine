import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ElementRef,
  ViewChild,
  OnInit,
  OnChanges,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { Localization } from '@shared/utilities/localization';
import { MachineDurations } from '@production-module/shared/services/machine-duration.service';
import { MachineState } from '@shared/model/machineState';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import { ViewMode } from '@production-module/shared//enums/viewMode';
import '@ui5/webcomponents/dist/Tag.js';
import '@ui5/webcomponents/dist/ProgressIndicator.js';

type MachineLoadState = 'Positive' | 'Negative' | 'None';
@Component({
  selector: 'machine-status-card',
  templateUrl: './machine-status-card.component.html',
  styleUrl: './machine-status-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineStatusCardComponent implements OnInit, OnChanges {
  @ViewChild('popover', { read: ElementRef }) popover!: ElementRef;
  /** State name string (e.g. "ACTIVE", or any admin-defined custom state) — resolved
   * against `machine_states` via `MachineStatesService.getByName()`, not a fixed union. */
  @Input() activity!: string;
  @Input() has_temperature!: boolean;
  @Input() has_rpm!: boolean;
  @Input() temp: number | null | undefined;
  @Input() maxRate: number | null | undefined;
  @Input() maxTemp: number | null | undefined;
  @Input() rpm: number | null | undefined;
  @Input() label!: string;
  @Input() runTime!: number;
  @Input() durations?: MachineDurations;
  @Input() viewMode = ViewMode.DETAILED;
  @Input() oee: number | null | undefined;
  @Input() hallName: string | null | undefined;
  @Input() groupName: string | null | undefined;
  @Input() shotCount: number | null | undefined;
  public localization = Localization;
  public viewModeEnum = ViewMode;
  fullLabel: string | undefined;

  constructor(private machineStates: MachineStatesService) {}

  ngOnInit(): void {
    if (this.temp !== null || this.rpm !== null) {
      this.fullLabel =
        this.label.length > 10
          ? this.label.substring(0, 10) + '...'
          : this.label;
    } else {
      this.fullLabel = this.label;
    }
  }

  // `activity` is the only input `resolvedState` depends on, but `durations`/`temp`/`rpm`
  // etc. change independently on every socket tick and would otherwise re-trigger a linear
  // lookup on every CD cycle via each of the ~6 getters below that read it. Recompute only
  // when `activity` itself changes.
  private _resolvedState?: MachineState;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activity']) {
      this._resolvedState = this.machineStates.getByName(this.activity);
    }
  }

  private get resolvedState(): MachineState | undefined {
    return this._resolvedState;
  }

  get badgeText(): string {
    return this.resolvedState?.name ?? this.activity ?? 'Unknown';
  }

  get statusColorVar(): string {
    return this.resolvedState?.color ?? 'var(--sapNeutralColor)';
  }

  get statusIcon(): string {
    return this.resolvedState?.icon ?? 'question-mark';
  }

  /** True for any non-productive state — replaces the old literal
   * `activity === 'MAINTENANCE' || 'IDLE' || 'FAULT'` checks that masked
   * temperature/load readings; an admin-defined custom state now masks
   * correctly too, based on its own `counts_as_productive` flag. */
  get isNonProductive(): boolean {
    return !(this.resolvedState?.counts_as_productive ?? false);
  }

  /** Live elapsed seconds since the current state was entered — resets to 0 on every
   * transition, not today's full accumulated total for that state. */
  get currentStatusSeconds(): number | null {
    if (this.durations?.current == null) return null;
    return this.durations.currentSeconds;
  }

  /** Epoch ms this machine's PLC last actually responded — `null` until at least one live
   * reading has been seen this session, independent of `activity`'s resolved state name. */
  get lastSeenAt(): number | null {
    return this.durations?.lastSeenAt ?? null;
  }

  /** Today's productive time (any state flagged `counts_as_productive`) as a % of total tracked time. */
  get availabilityPercent(): number | null {
    const total = this.durations?.total;
    if (!total || !this.durations) return null;
    const productiveIds = this.machineStates.getProductiveIds();
    const productiveSeconds = Object.entries(this.durations.perState)
      .filter(([stateId]) => productiveIds.has(Number(stateId)))
      .reduce((sum, [, seconds]) => sum + (seconds ?? 0), 0);
    return Math.round((productiveSeconds / total) * 100);
  }

  get isOverTemp(): boolean {
    return (
      this.has_temperature &&
      this.temp != null &&
      this.maxTemp != null &&
      this.temp >= this.maxTemp
    );
  }

  get isOverLoad(): boolean {
    return (
      this.has_rpm &&
      this.rpm != null &&
      this.maxRate != null &&
      this.rpm >= this.maxRate
    );
  }

  get loadValue(): number {
    return this.resolvedState?.counts_as_productive ? this.loadPercent : 0;
  }

  get loadValueState(): MachineLoadState {
    if (this.isOverLoad) {
      return 'Negative';
    }
    return this.resolvedState?.counts_as_productive ? 'Positive' : 'None';
  }

  get loadPercent(): number {
    const value = this.rpm ?? 0;
    if (value < 0) {
      return 0;
    }
    if (value > 100) {
      return 100;
    }
    return value;
  }

  openPopover(): void {
    if (this.popover?.nativeElement) {
      this.popover.nativeElement.open = true;
    }
  }

  closePopover(): void {
    if (this.popover?.nativeElement) {
      this.popover.nativeElement.open = false;
    }
  }
  get alertHeader(): string | null {
    if (this.isOverTemp && this.isOverLoad) {
      return 'Over Temperature & Load';
    } else if (this.isOverTemp) {
      return 'Over Temperature';
    } else if (this.isOverLoad) {
      return 'Over Load';
    }
    return null;
  }
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenWidth(event.target.innerWidth);
  }

  private checkScreenWidth(width: number) {
    if (width < 1420) {
      this.fullLabel =
        this.label.length > 5 ? this.label.substring(0, 5) + '...' : this.label;
    } else {
      this.fullLabel = this.label;
    }
  }
}
