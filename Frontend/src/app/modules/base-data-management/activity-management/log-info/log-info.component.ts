import { ActivityLog } from '@app/shared/model/activitylog';
import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  input,
  OnInit,
} from '@angular/core';
import {
  DialogComponent,
  InputComponent,
  TabContainerComponent,
  SwitchComponent,
} from '@ui5/webcomponents-ngx';
import { FormsModule } from '@angular/forms';
import { Localization } from '@shared/utilities/localization';

@Component({
  selector: 'app-log-info',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputComponent,
    DialogComponent,
    TabContainerComponent,
    SwitchComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './log-info.component.html',
  styleUrl: './log-info.component.scss',
})
export class LogInfoComponent implements OnInit {
  public localization = Localization;
  @Input() isOpen: EventEmitter<void> = new EventEmitter<void>();
  @Input() logData: ActivityLog = new ActivityLog().deserialize({});
  open: boolean = false;

  constructor(private datePipe: DatePipe) {}
  ngOnInit(): void {
    this.isOpen.subscribe(() => {
      this.open = true;
    });
  }

  getModelName(modelType: string | undefined): string {
    return modelType?.split('\\').pop() || 'Unknown Model';
  }

  formatJSON(data: any): string {
    try {
      const parsedData = JSON.parse(data);
      return JSON.stringify(parsedData, null, 2);
    } catch (error) {
      return 'Invalid JSON';
    }
  }

  formatDate(dateString: string): string {
    return this.datePipe.transform(dateString, 'dd/MM/yyyy') || '';
  }
}
