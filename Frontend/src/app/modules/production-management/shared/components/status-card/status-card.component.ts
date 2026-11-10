import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';

interface StatusPalette {
  icon: string;
  /** SAP theme CSS var (or `machine_states.color`) driving icon, accent bar and progress fill. */
  color: string;
  /** Icon chip / progress-track background. */
  tint: string;
}

const OVERALL_PALETTE: StatusPalette = {
  icon: 'tnt/throughput-backlog',
  color: 'var(--sapInformationColor, #427cac)',
  tint: 'var(--sapInformationBackground, #e8f4fe)',
};

@Component({
  selector: 'status-card',
  templateUrl: './status-card.component.html',
  styleUrls: ['./status-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusCardComponent {
  @Input() percent = 0;
  @Input() progress = 0;
  @Input() label = $localize`Machines Active`;
  /** 'overall' for the fixed summary tile; otherwise a `machine_states.id` — one tile
   * per active state, not a fixed Active/Idle/Inactive/Maintenance/Fault set. */
  @Input() type: 'overall' | number = 'overall';
  @Input() count = 0;
  @Input() totalMachines: number | undefined = undefined;

  constructor(private machineStates: MachineStatesService) {}

  get palette(): StatusPalette {
    if (this.type === 'overall') return OVERALL_PALETTE;
    return {
      icon: this.machineStates.getIcon(this.type),
      color: this.machineStates.getColor(this.type),
      tint: this.machineStates.getTint(this.type),
    };
  }

  get isOverall(): boolean {
    return this.type === 'overall';
  }
}
