import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { OverviewTile } from '../../interface/interface';
import { Accent } from '../../utils/types';

@Component({
  selector: 'app-production-overview',
  templateUrl: './production-overview.component.html',
  styleUrl: './production-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionOverviewComponent {
  @Input() periodLabel: string = 'May, 2024';
  @Input() productionTarget: number = 72000;
  @Input() productionAchieved: number = 62000;
  @Input() machineOk: number = 72;
  @Input() machineTotal: number = 80;
  @Input() wastage: number = 160;
  @Input() unit: string = 'kg';
  @Input() compact = false;
}
