import { Component, EventEmitter, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { EmployeeGroup } from '@app/modules/hr-management/shared/models/employeeGroup';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import { Localization } from '@app/shared/utilities/localization';
import moment from 'moment';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@app/shared/enums/saveMode';
import { ThemeService } from '@app/services/theme.service';
import { SocketService } from '@app/services/socket.service';
import { ValueState } from "@shared/utilities/value-state-wrapper";

@Component({
  selector: 'app-shift-planning',
  templateUrl: './shift-planning.component.html',
  styleUrl: './shift-planning.component.scss',
})
export class ShiftPlanningComponent {
  @Output() refreshEmit: EventEmitter<void> = new EventEmitter<void>();
  saveMode: saveMode = saveMode.POST;
  localization = Localization;
  isShiftPlanningOpen: boolean = false;
  employeeGroupsList: EmployeeGroup[] = [];
  employeeShiftsList: EmployeeShift[] = [];
  isLoading: boolean = false;
  startDate: string = '';
  endDate: string = '';
  lts_roster_stdate: string = '';
  lts_roster_enddate: string = '';
  rosterCreateType: 'SINGLE' | 'MULTIPLE' = 'MULTIPLE';
  dateRangeValue: string = '';
  editRosterPayload: any[] = [];
  validationMessage = Localization.requiredField;
  employeeSearchText: { [shiftKey: string]: string } = {};
  valueStateOptions = {
    dateRangeValue: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toast: ToastService,
    public theme: ThemeService,
    private socketService: SocketService
  ) {
    this.initEmployeeGroups();
    this.initEmployeeShifts();
    this.initLastGeneratedRoster();
  }

  initEmployeeGroups() {
    this.commonService.get('EmployeeGroups?$filter=is_active eq true and is_permanent eq false').subscribe(
      (res: any) => {
        this.employeeGroupsList = res.value;
      },
      (error) => {
        console.error('Error while fetching employee groups', error);
      }
    );
  }

  initEmployeeShifts() {
    this.commonService
      .get('EmployeeShifts?$filter=is_active eq true')
      .subscribe(
        (res: any) => {
          this.employeeShiftsList = res.value;
        },
        (error) => {
          console.error('Error while fetching employee shifts', error);
        }
      );
  }

  checkValidation(event: any, field: string) {
      const value = event.target.value ? event.target.value : "";

      switch (field) {
        case "dateRangeValue":
          if (!value.trim()) {
            this.valueStateOptions.dateRangeValue = ValueState.Negative;
          } else {
            this.dateRangeValue = value;
            this.valueStateOptions.dateRangeValue = ValueState.None;
          }
          break;
        default:
          break;
      }
    }

  validateForm(): boolean {
      let isValid = true;
      
      if (!this.dateRangeValue.trim()) {
        this.valueStateOptions.dateRangeValue = ValueState.Negative;
        this.validationMessage = Localization.requiredField;
        isValid = false;
      } else if (!this.startDate || !this.endDate) {
        this.valueStateOptions.dateRangeValue = ValueState.Negative;
        this.validationMessage = Localization.invalidDateFormat;
        isValid = false;
      } else {
        this.valueStateOptions.dateRangeValue = ValueState.None;
        this.validationMessage = Localization.requiredField;
      }

      return isValid;
    }


  profilebgChange(first_letter: string, last_letter: string): { [key: string]: string } {
    const letters = (first_letter + last_letter).toUpperCase();
    let hash = 0;
    for (let i = 0; i < letters.length; i++) {
      hash += letters.charCodeAt(i);
    }

    const index = (hash % 10) + 1;
    return {
      'background-color': `var(--sapAccentBackgroundColor${index})`,
      color: `var(--sapAccentColor${index})`,
    };
  }

  onGroupSelectionChange(event: any, shiftId: any) {
    const items: any[] = event?.detail?.items ?? event?.items ?? [];
    const selectedGroups = items
      .map((item: any) => ({ id: Number(item.id), name: item.text ?? '' }))
      .filter((group) => !!group.id);

    this.applyShiftGroups(shiftId, selectedGroups);
  }

  isGroupSelected(shift: EmployeeShift, groupId: number | string | undefined): boolean {
    if (groupId === undefined) return false;
    const groupIds = shift.group_ids ?? (shift.group_id ? [shift.group_id] : []);
    return groupIds.map(Number).includes(Number(groupId));
  }

  applyShiftGroups(
    shiftId: number,
    groups: { id: number; name: string }[],
    rosterId?: number
  ) {
    const groupIds = groups.map((group) => group.id);
    const groupNames = groups.map((group) => group.name).join(', ');

    const shift = this.employeeShiftsList.find(
      (empShift) => empShift.id === shiftId
    );
    if (shift) {
      shift.group_ids = groupIds;
      shift.group_id = groupIds[0];
    }

    if (this.saveMode === saveMode.PUT) {
      const existingIndex = this.editRosterPayload.findIndex(
        (item: any) => item.shift_id === shiftId
      );
      const entry: any = { shift_id: shiftId, group_ids: groupIds, group: groupNames };
      if (rosterId) {
        entry.roster_id = rosterId;
      } else if (existingIndex !== -1 && this.editRosterPayload[existingIndex].roster_id) {
        entry.roster_id = this.editRosterPayload[existingIndex].roster_id;
      }

      if (existingIndex !== -1) {
        this.editRosterPayload[existingIndex] = entry;
      } else {
        this.editRosterPayload.push(entry);
      }
    }

    if (!groupIds.length) {
      if (shift) shift.employees = [];
      return;
    }

    const groupFilter = groupIds.map((id) => `group_id eq ${id}`).join(' or ');
    this.isLoading = true;
    this.commonService.get<any>(`Employees?$filter=${groupFilter}`).subscribe({
      next: (res) => {
        if (shift) shift.employees = res.value || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching employees:', err);
        this.isLoading = false;
      },
    });
  }

  getShiftSearchKey(shift: EmployeeShift): string {
    return String(shift.id ?? shift.custom_id ?? '');
  }

  private getShiftRoster(shiftId: number) {
    return this.editRosterPayload.find((item: any) => Number(item.shift_id) === Number(shiftId));
  }

  private isFutureDate(): boolean {
    if (!this.startDate) return false;

    const rosterDate = moment(this.startDate, ['YYYY/MM/DD', 'YYYY-MM-DD'], true);
    if (!rosterDate.isValid()) return false;

    const today = moment().startOf('day');
    return rosterDate.startOf('day').isAfter(today);
  }

  canDeleteShift(shift: EmployeeShift): boolean {
    if (this.saveMode !== saveMode.PUT) return false;
    if (!this.isFutureDate()) return false;
    const shiftRoster = this.getShiftRoster(Number(shift.id));
    if (!shiftRoster?.roster_id) return false;
    return !!shiftRoster.group_ids?.length;
  }

  deleteShift(shift: EmployeeShift) {
    if (!this.canDeleteShift(shift)) return;

    const shiftId = Number(shift.id);
    const shiftRoster = this.getShiftRoster(shiftId);
    if (!shiftRoster?.roster_id) return;

    this.isLoading = true;
    this.commonService.delete(`Rosters(${shiftRoster.roster_id})`, true).subscribe({
      next: () => {
        this.editRosterPayload = this.editRosterPayload.filter(
          (item: any) => Number(item.shift_id) !== shiftId
        );

        const shiftData = this.employeeShiftsList.find(
          (item: any) => Number(item.id) === shiftId
        );
        if (shiftData) {
          shiftData.group_id = undefined;
          shiftData.group_ids = [];
          shiftData.employees = [];
        }

        this.toast.show('remove');
        this.isLoading = false;
      },
      error: () => {
        this.toast.show('error');
        this.isLoading = false;
      },
    });
  }

  getEmployeeSearchValue(shift: EmployeeShift): string {
    return this.employeeSearchText[this.getShiftSearchKey(shift)] || '';
  }

  onEmployeeSearchChange(shift: EmployeeShift, value: string) {
    this.employeeSearchText[this.getShiftSearchKey(shift)] = value || '';
  }

  getFilteredShiftEmployees(shift: EmployeeShift) {
    const searchText = this.getEmployeeSearchValue(shift).trim().toLowerCase();
    if (!searchText) {
      return shift.employees || [];
    }

    return (shift.employees || []).filter((emp: any) => {
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`
        .trim()
        .toLowerCase();
      const employeeNo = `${emp.employee_no || ''}`.toLowerCase();
      return fullName.includes(searchText) || employeeNo.includes(searchText);
    });
  }

  formatDate(date: Date | string) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  onRosterSave() {
    if (!this.validateForm()) return;
    this.isLoading = true;
    const formattedStart = this.formatDate(this.startDate);
    const formattedEnd = this.formatDate(this.endDate);

    const payload = this.employeeShiftsList.map((shift) => {
      const editData = this.editRosterPayload.find(
        (roster: any) => roster.shift_id === shift.id
      );

      const groupIds = shift.group_ids?.length ? shift.group_ids : editData?.group_ids ?? [];

      return {
        roster_id: editData?.roster_id || null,
        shift_id: shift.id,
        group_ids: groupIds,
        start_date: formattedStart,
        end_date: formattedEnd,
      };
    });

    const saveRoster = { rosters: payload };
    const apiUrl = 'hrm/rosters';

    const request$ = this.commonService.post(apiUrl, saveRoster, false);

    request$.subscribe({
      next: (res) => {
        this.refreshEmit.emit();
        this.socketService.emit('biometrics_roster_reload');
        this.isLoading = false;
        this.toast.show(this.saveMode === saveMode.PUT ? 'edit' : 'add');
        this.closeDialog();
      },
      error: (err) => {
        console.error('Error saving roster plan:', err);
        this.isLoading = false;
        if (err.status === 422 && err.error.errors?.rosters) {
          this.toast.show('error');
        }
      },
    });
  }

  dateRangePickerChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input?.value?.trim() || '';

    this.dateRangeValue = value;

    if (!value) {
      this.startDate = '';
      this.endDate = '';
      this.validationMessage = Localization.requiredField;
      this.valueStateOptions.dateRangeValue = ValueState.Negative;
      return;
    }

    const [startDate, endDate] = value.split(' - ');
    const parsedStartDate = moment(startDate, 'DD/MM/YYYY', true);
    const parsedEndDate = moment(endDate, 'DD/MM/YYYY', true);

    if (!parsedStartDate.isValid() || !parsedEndDate.isValid()) {
      this.startDate = '';
      this.endDate = '';
      this.validationMessage = Localization.invalidDateFormat;
      this.valueStateOptions.dateRangeValue = ValueState.Negative;
      return;
    }

    this.startDate = parsedStartDate.startOf('day').toISOString(true);
    this.endDate = parsedEndDate.endOf('day').toISOString(true);
    this.validationMessage = Localization.requiredField;
    this.valueStateOptions.dateRangeValue = ValueState.None;
  }

  initLastGeneratedRoster() {
    this.commonService.get('hrm/rosters/latest', false).subscribe({
      next: (res: any) => {
        const data = res.latest_roster;
        const today = moment().startOf('day');
        if (data && data.end_date) {
          const nextAvailableDate = moment(data.end_date)
            .add(1, 'day')
            .startOf('day');
          this.lts_roster_stdate = moment
            .max(today, nextAvailableDate)
            .format('DD/MM/YYYY');
          this.lts_roster_enddate = this.lts_roster_stdate;
        } else {
          this.lts_roster_stdate = today.format('DD/MM/YYYY');
          this.lts_roster_enddate = today.format('DD/MM/YYYY');
        }
      },
      error(err) {
        console.error(err, 'somthing went wrong!');
      },
    });
  }

  closeDialog() {
    this.isShiftPlanningOpen = false;
    this.isLoading = false;
    this.employeeGroupsList = [];
    this.employeeShiftsList = [];
    this.startDate = '';
    this.endDate = '';
    this.lts_roster_stdate = '';
    this.lts_roster_enddate = '';
    this.dateRangeValue = '';
    this.editRosterPayload = [];
    this.employeeSearchText = {};
    this.validationMessage = Localization.requiredField;
    this.valueStateOptions.dateRangeValue = ValueState.None;
    this.initEmployeeGroups();
    this.initEmployeeShifts();
    this.initLastGeneratedRoster();
    const picker = document.querySelector('ui5-daterange-picker') as any;
    if (picker) {
      picker.value = '';
    }
  }
}
