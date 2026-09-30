import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { Capacity } from '@shared/model/capacity';
import { ToastService } from '@app/services/toast-service/toast.service';

@Component({
  selector: 'app-capacity-form',
  templateUrl: './capacity-form.component.html',
  styleUrl: './capacity-form.component.scss',
})
export class CapacityFormComponent implements OnInit {
  @Input() saveMode = 'POST';
  @Input() capacity: Capacity = new Capacity().deserialize({});
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() RefreshTable = new EventEmitter<any>();
  open: boolean = false;
  loading: boolean = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  valueStateOptions = {
    name: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {}

  AddCapacity() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'Capacities';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.capacity.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Capacities(${this.capacity.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.capacity.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          this.CloseDialog();
          this.RefreshTable.emit();
          this.toastService.show(this.ToastType);
        },
        error: (error: any) => {
          this.open = false;
          this.CloseDialog();
          this.toastService.show('error');
        },
      });
    }
  }

  checkValidation(event: any) {
    const value = event.target.value;
    if (!value.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
    } else {
      this.valueStateOptions.name = ValueState.None;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.capacity.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.capacity = new Capacity().deserialize({});
  }
}
