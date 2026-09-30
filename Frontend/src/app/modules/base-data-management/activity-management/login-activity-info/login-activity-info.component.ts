import { LoginActivity } from '@app/shared/model/loginActivity';
import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  OnInit,
} from '@angular/core';
import {
  DialogComponent,
  InputComponent,
  TabContainerComponent,
} from '@ui5/webcomponents-ngx';
import { FormsModule } from '@angular/forms';
import { Localization } from '@shared/utilities/localization';

@Component({
  selector: 'app-login-activity-info',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputComponent,
    DialogComponent,
    TabContainerComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './login-activity-info.component.html',
  styleUrl: './login-activity-info.component.scss',
})
export class LoginActivityInfoComponent implements OnInit {
  public localization = Localization;
  @Input() isOpen: EventEmitter<void> = new EventEmitter<void>();
  @Input() activityData: LoginActivity = new LoginActivity().deserialize({});
  open: boolean = false;

  constructor(private datePipe: DatePipe) {}

  ngOnInit(): void {
    this.isOpen.subscribe(() => {
      this.open = true;
    });
  }

  formatDate(dateString: string | undefined): string {
    return this.datePipe.transform(dateString, 'dd/MM/yyyy') || '';
  }

  formatTime(dateString: string | undefined): string {
    return this.datePipe.transform(dateString, 'HH:mm') || '';
  }

  toStr(value: number | string | undefined): string {
    return value === undefined || value === null ? '' : String(value);
  }

  formatJSON(data: string | undefined): string {
    if (!data) return '';
    try {
      return JSON.stringify(JSON.parse(data), null, 2);
    } catch (error) {
      return 'Invalid JSON';
    }
  }
}
