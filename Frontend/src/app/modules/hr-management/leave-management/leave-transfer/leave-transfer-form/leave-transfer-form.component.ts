import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Employee } from '@app/shared/model/employee';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import moment from 'moment';

interface CalendarDay {
  dateStr: string;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  weekend: any | null;
  swappedTo: any | null;
}

@Component({
  selector: 'app-leave-transfer-form',
  templateUrl: './leave-transfer-form.component.html',
  styleUrl: './leave-transfer-form.component.scss',
})
export class LeaveTransferFormComponent implements OnInit {
  @Input() saveMode = 'POST';
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() RefreshTable = new EventEmitter<any>();
  open: boolean = false;
  loading: boolean = false;
  odata: boolean;
  api: boolean;
  public validationMessage = Localization.requiredField;

  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  valueStateOptions = {
    name: ValueState.None,
  };
  selectedEmployeeId: number | null = null;
  employeeTitle = '';
  holidays: any[] = [];
  swapList: any[] = [];

  viewMonth = moment().startOf('month');
  calendarWeeks: CalendarDay[][] = [];
  readonly weekdayLabels = moment.weekdaysShort();
  dragOverDate: string | null = null;

  constructor(
    private commonService: CommonService,
    private toastService: ToastService
  ) {
    this.odata = commonService.odata;
    this.api = commonService.api;
  }

  ngOnInit(): void {
    this.selectFirstEmployee();
    this.buildCalendar();
  }

  checkValidation(event: any) {
    const value = event.target.value;
    if (!value.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
    } else {
      this.valueStateOptions.name = ValueState.None;
    }
  }

  onServerEmployeeSelect(item: any) {
    if (!item) return;
    this.selectedEmployeeId = Number(item.id);
    this.employeeTitle = this.employeeDisplayName(item);
    this.InitEmployeeWeekend(this.selectedEmployeeId);
  }

  InitEmployeeWeekend(id: any) {
    this.loading = true;
    this.commonService
      .get(
        `EmployeeWeekends?$expand=type&$filter=employee_id eq ${id}&$top=5000`
      )
      .subscribe((res: any) => {
        this.holidays = res.value;
        this.InitSwapedList(id);
      });
  }

  InitSwapedList(employeeid: any) {
    this.loading = true;

    this.commonService
      .get(
        `EmployeeHolidaySwaps?$filter=employee_id eq ${employeeid}&$top=5000`
      )
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.swapList = res.value;
          this.buildCalendar();
        },
        error: (err) => {
          this.loading = false;
          console.error(err);
        },
      });
  }

  employeeDisplayName(employee: Employee): string {
    const fullName = [employee.first_name, employee.last_name]
      .filter((part) => !!part)
      .join(' ');
    return `${employee.employee_no} - ${fullName}`;
  }

  private selectFirstEmployee() {
    this.commonService.get('Employees?$filter=is_active eq true&$top=1', this.odata).subscribe({
      next: (res: any) => {
        const first = res.value?.[0];
        if (!first || this.selectedEmployeeId) return;
        const employee = new Employee().deserialize(first);
        this.selectedEmployeeId = Number(employee.id);
        this.employeeTitle = this.employeeDisplayName(employee);
        this.InitEmployeeWeekend(this.selectedEmployeeId);
      },
      error: (err) => console.error('Employee fetch error', err),
    });
  }

  isSwapDateMatched(holidayDate: string): boolean {
    return this.swapList.some(
      (swap) => swap.original_holiday_date === holidayDate
    );
  }

  formatDate(date: string): string {
    return date ? moment(date).format('MMM D') : '';
  }

  buildCalendar(): void {
    const start = this.viewMonth.clone().startOf('month').startOf('week');
    const end = this.viewMonth.clone().endOf('month').endOf('week');
    const today = moment();
    const weeks: CalendarDay[][] = [];
    const cursor = start.clone();

    while (cursor.isSameOrBefore(end)) {
      const week: CalendarDay[] = [];
      for (let i = 0; i < 7; i++) {
        const dateStr = cursor.format('YYYY-MM-DD');
        week.push({
          dateStr,
          dayNum: cursor.date(),
          inMonth: cursor.isSame(this.viewMonth, 'month'),
          isToday: cursor.isSame(today, 'day'),
          isPast: cursor.isBefore(today, 'day'),
          weekend:
            this.holidays.find((h) => h.weekend_date === dateStr) ?? null,
          swappedTo:
            this.swapList.find((s) => s.swapped_holiday_date === dateStr) ??
            null,
        });
        cursor.add(1, 'day');
      }
      weeks.push(week);
    }
    this.calendarWeeks = weeks;
  }

  prevMonth(): void {
    this.viewMonth = this.viewMonth.clone().subtract(1, 'month');
    this.buildCalendar();
  }

  nextMonth(): void {
    this.viewMonth = this.viewMonth.clone().add(1, 'month');
    this.buildCalendar();
  }

  isDraggable(day: CalendarDay): boolean {
    return (
      !!day.weekend &&
      !day.isPast &&
      !day.isToday &&
      !this.isSwapDateMatched(day.dateStr)
    );
  }

  findDay(dateStr: string): CalendarDay | undefined {
    for (const week of this.calendarWeeks) {
      const found = week.find((d) => d.dateStr === dateStr);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  dropPredicate = (drag: CdkDrag<string>, drop: CdkDropList): boolean => {
    const day = this.findDay(drop.id);
    if (!day) {
      return false;
    }
    return !day.isPast && !day.weekend && !day.swappedTo && drop.id !== drag.data;
  };

  onListEntered(day: CalendarDay): void {
    this.dragOverDate = day.dateStr;
  }

  onListExited(day: CalendarDay): void {
    if (this.dragOverDate === day.dateStr) {
      this.dragOverDate = null;
    }
  }

  onCalendarDrop(event: CdkDragDrop<string>): void {
    this.dragOverDate = null;
    const sourceDate = event.item.data as string;
    const targetDate = event.container.id;
    if (!sourceDate || sourceDate === targetDate) {
      return;
    }
    this.performSwap(sourceDate, targetDate);
  }

  performSwap(originalHolidayDate: string, targetDate: string): void {
    if (!this.selectedEmployeeId) {
      this.toastService.show('error');
      return;
    }
    this.loading = true;

    const weekend = this.holidays.find(
      (h) => h.weekend_date === originalHolidayDate
    );

    const payload = {
      employee_id: this.selectedEmployeeId,
      weekend_id: weekend?.id ?? null,
      original_holiday_date: originalHolidayDate,
      swapped_holiday_date: targetDate,
      type: 'WEEKEND',
    };

    const weekendCheckUrl = `EmployeeWeekends?$filter=employee_id eq ${this.selectedEmployeeId} and weekend_date eq '${targetDate}'`;

    this.commonService.get(weekendCheckUrl).subscribe({
      next: (weekendRes: any) => {
        if (weekendRes.value && weekendRes.value.length > 0) {
          this.toastService.show('error');
          this.loading = false;
          return;
        }
        const swapCheckUrl = `EmployeeHolidaySwaps?$filter=employee_id eq ${this.selectedEmployeeId} and swapped_holiday_date eq '${targetDate}'`;

        this.commonService.get(swapCheckUrl).subscribe({
          next: (swapRes: any) => {
            if (swapRes.value && swapRes.value.length > 0) {
              this.toastService.show('error');
              this.loading = false;
              return;
            }

            this.commonService.post('EmployeeHolidaySwaps', payload).subscribe({
              next: () => {
                this.RefreshTable.emit();
                this.toastService.show('add');
                this.InitEmployeeWeekend(this.selectedEmployeeId);
              },
              error: (err) => {
                console.error(err);
                this.loading = false;
              },
            });
          },
          error: (err) => {
            console.error('Swap check failed:', err);
            this.loading = false;
          },
        });
      },
      error: (err) => {
        console.error('Weekend check failed:', err);
        this.loading = false;
      },
    });
  }

  removeSwap(swapId: number): void {
    this.loading = true;
    this.commonService.delete(`EmployeeHolidaySwaps/${swapId}`).subscribe({
      next: () => {
        this.RefreshTable.emit();
        this.toastService.show('add');
        this.InitEmployeeWeekend(this.selectedEmployeeId);
      },
      error: (err) => {
        console.error('Remove swap failed:', err);
        this.loading = false;
      },
    });
  }

  CloseDialog() {
    this.viewMonth = moment().startOf('month');
    this.buildCalendar();
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
  }
}
