import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@app/shared/enums/saveMode';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import { ShiftOverrides } from '@app/modules/hr-management/shared/models/shiftOverrides';
import { Localization } from '@app/shared/utilities/localization';
import { ValueState } from '@app/shared/utilities/value-state-wrapper';
import { ShiftType } from '@app/modules/hr-management/shared/enums/shiftType';
@Component({
  selector: 'app-replacement-form',
  templateUrl: './replacement-form.component.html',
  styleUrl: './replacement-form.component.scss',
})
export class ReplacementFormComponent implements OnInit {
  @ViewChild("shiftCombo") shiftCombo: any;
  @ViewChild("replacementEmployeeCombo") replacementEmployeeCombo: any;
  @ViewChild("absentEmployeeCombo") absentEmployeeCombo: any;
  @Output() RefreshTable = new EventEmitter<any>();

  ShiftType = ShiftType; 
  typeList = Object.values(ShiftType); 
  saveMode: string = saveMode.POST;
  open: boolean = false;
  loading: boolean = false;
  localization = Localization;
  validationMessage = Localization.requiredField;
  shiftList: EmployeeShift[] = [];
  employeeList: any[] = [];
  shiftOverride = new ShiftOverrides().deserialize({});
  selectedAbsentEmployeeName: string = '';
  selectedReplacementEmployeeName: string = '';
  selectedShiftName: string = '';
  selectedShift: any;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  isSameEmployee: boolean = false;
  replacementEmployeeLabel: string = 'Replacement Employee';
  replacementEmployeePlaceholder: string = 'Select replacement employee';
  
  valueStateOptions = {
    absent_employee: ValueState.None,
    replacement_employee: ValueState.None,
    shift: ValueState.None,
    date: ValueState.None,
    type: ValueState.None,
  };
  constructor(
    private commonService: CommonService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.initiaLizeEmployeeShifts();
    this.initalizeEmployeeLists();
  }

  initiaLizeEmployeeShifts() {
    this.loading = true;
    this.commonService
      .get('EmployeeShifts?$filter=is_active eq true')
      .subscribe({
        next: (res: any) => {
          this.shiftList = res.value;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error fetching shifts:', err);
        },
      });
  }

  initalizeEmployeeLists() {
    this.loading = true;
    this.commonService.get('Employees?$filter=is_active eq true').subscribe({
      next: (res: any) => {
        this.employeeList = res.value;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching employees:', err);
      },
    });
  }
  onDateChange(event: any) {
    const value = event.target.value || '';
    this.shiftOverride.date = value;
    this.checkValidation(event, 'date'); 
  }

  populatedData() {
    this.selectedAbsentEmployeeName =
      this.selectedShift.absentEmployee.first_name +
      ' ' +
      this.selectedShift.absentEmployee.last_name;
    this.selectedReplacementEmployeeName =
      this.selectedShift.replacementEmployee.first_name +
      ' ' +
      this.selectedShift.replacementEmployee.last_name;
    this.selectedShiftName = this.selectedShift.shift.name;
    this.shiftOverride.type = this.selectedShift.type;
    this.onTypeChange({ target: { value: this.shiftOverride.type } });
  }
  onTypeChange(event: any) {
  const selectedType = event.target.value;
  this.shiftOverride.type = selectedType;

  switch (selectedType) {
    case ShiftType.REPLACEMENT:
      this.replacementEmployeeLabel = 'Replacement Employee';
      this.replacementEmployeePlaceholder = 'Select replacement employee';
      break;
    case ShiftType.SWAP:
      this.replacementEmployeeLabel = 'Swap Employee';
      this.replacementEmployeePlaceholder = 'Select swap employee';
      break;
  }
}


  onShiftChange(event: any) {
    this.shiftOverride.shift_id = event.detail.item.id;
  }

onAbsentEmployeeChange(event: any) {
  const selectedId = event.detail.item.id;
  this.shiftOverride.absent_employee_id = selectedId;
  if (this.shiftOverride.replacement_employee_id === this.shiftOverride.absent_employee_id) {
    this.valueStateOptions.absent_employee = ValueState.Negative;
    this.valueStateOptions.replacement_employee = ValueState.Negative;
    this.isSameEmployee = true;
  } else {
    this.valueStateOptions.absent_employee = ValueState.None;
    this.valueStateOptions.replacement_employee = ValueState.None;
    this.validationMessage = Localization.requiredField;
    this.isSameEmployee = false;
  }

}


onReplacementEmployeeChange(event: any) {
  const selectedId = event.detail.item.id;
  this.shiftOverride.replacement_employee_id = selectedId;
  if (this.shiftOverride.absent_employee_id === this.shiftOverride.replacement_employee_id) {

    this.valueStateOptions.absent_employee = ValueState.Negative;
    this.valueStateOptions.replacement_employee = ValueState.Negative;
    this.isSameEmployee = true;
  } else {
    this.valueStateOptions.absent_employee = ValueState.None;
    this.valueStateOptions.replacement_employee = ValueState.None;
    this.validationMessage = Localization.requiredField;
    this.isSameEmployee = false;
  }
}


  validateForm(): boolean {
    let isValid = true;

    if (!this.shiftOverride.shift_id) {
      this.valueStateOptions.shift = ValueState.Negative;
      isValid = false;
    }
    if(!this.shiftOverride.type) {
      this.valueStateOptions.type = ValueState.Negative;
      isValid = false;
    }
    if (!this.shiftOverride.date?.trim()) {
      this.valueStateOptions.date = ValueState.Negative;
      isValid = false;
    }

    if (!this.shiftOverride.absent_employee_id) {
      this.valueStateOptions.absent_employee = ValueState.Negative;
      isValid = false;
    }

    if (
      this.shiftOverride.type !== ShiftType.EXTRA &&
      !this.shiftOverride.replacement_employee_id
    ) {
      this.valueStateOptions.replacement_employee = ValueState.Negative;
      isValid = false;
    }
    if (this.shiftOverride.type !== ShiftType.EXTRA &&
      this.shiftOverride.absent_employee_id && 
      this.shiftOverride.replacement_employee_id &&
      this.shiftOverride.absent_employee_id === this.shiftOverride.replacement_employee_id) {
      this.valueStateOptions.absent_employee = ValueState.Negative;
      this.valueStateOptions.replacement_employee = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : '';
    switch (field) {
      case 'date':
        if (!value.trim()) {
          this.valueStateOptions.date = ValueState.Negative;
        } else {
          this.shiftOverride.date = value;
          this.valueStateOptions.date = ValueState.None;
        }

        break;
      case 'type':
        if(!value.trim()) {
          this.valueStateOptions.type = ValueState.Negative;
        } else {
          this.shiftOverride.type = value;
          this.valueStateOptions.type = ValueState.None;
        }
        break;
      case 'shift':
        if (!value.trim()) {
          this.valueStateOptions.shift = ValueState.Negative;
        } else {
          this.shiftOverride.shift_id = value;
          this.valueStateOptions.shift = ValueState.None;
        }
        break;
      case 'absent_employee':
        if (!value.trim()) {
          this.valueStateOptions.absent_employee = ValueState.Negative;
        } else {
          this.shiftOverride.absent_employee_id = value;
          this.valueStateOptions.absent_employee = ValueState.None;
        }
        break;
      case 'replacement_employee':
        if (!value.trim()) {
          this.valueStateOptions.replacement_employee = ValueState.Negative;
        } else {
          // this.shiftOverride.replacement_employee_id = value;
          this.valueStateOptions.replacement_employee = ValueState.None;
        }
        break;
      default:
        break;
    }
  }

  saveShiftOverride() {
    if (!this.validateForm()) {
      return;
    }
    this.loading = true;
    let url = '';
    let request$;
    const payload = {
      absent_employee_id: this.shiftOverride.absent_employee_id,
      replacement_employee_id: this.shiftOverride.replacement_employee_id,
      shift_id: this.shiftOverride.shift_id,
      date: this.shiftOverride.date,
      type: this.shiftOverride.type,
    };
    if (this.saveMode === saveMode.POST) {
      url = 'ShiftOverrides';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, payload, true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `ShiftOverrides(${this.shiftOverride.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, payload, true);
    }
    request$?.subscribe({
      next: (res: any) => {
        this.closeDialog();
        this.RefreshTable.emit();
        this.loading = false;
        this.toastService.show(this.ToastType);
      },
      error: (err: any) => {
        console.error('Api error', err);
        this.closeDialog();
        this.toastService.show('error');
        this.loading = false;
      },
    });
  }
private resetComboBoxes() {
  const combos = [
    this.shiftCombo,
    this.absentEmployeeCombo,
    this.replacementEmployeeCombo,
  ];

  combos.forEach(combo => {
    if (combo) {
      combo.value = "";
      combo.selectedItem = null;
    }
  });
}
  closeDialog() {
    this.open = false;
    this.loading = false;
    this.isSameEmployee = false;
    this.shiftOverride = new ShiftOverrides().deserialize({});
    this.valueStateOptions = {
      absent_employee: ValueState.None,
      replacement_employee: ValueState.None,
      shift: ValueState.None,
      date: ValueState.None,
      type: ValueState.None,
    };
    this.selectedAbsentEmployeeName = '';
    this.selectedReplacementEmployeeName = '';
    this.selectedShiftName = '';
    this.selectedShift = null;
    this.replacementEmployeeLabel = 'Replacement Employee';
    this.replacementEmployeePlaceholder = 'Select replacement employee';
    this.resetComboBoxes();
  }
}
