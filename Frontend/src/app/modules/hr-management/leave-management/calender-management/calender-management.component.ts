import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonService } from '@app/services/common-service/common.service';
import { Month } from '@app/modules/hr-management/shared/enums/month';
import { ToastService } from '@app/services/toast-service/toast.service';
import { WeekDays } from '@app/modules/hr-management/shared/enums/weekDays';
import { DateFormatterService } from '@app/shared/utilities/date-format';
import { Employee } from '@app/shared/model/employee';
import { CalendarType } from '@app/modules/hr-management/shared/enums/calendarType';
import { WeekendType } from '@app/modules/hr-management/shared/enums/weekendType';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { AuthService } from '@app/services/auth-service/auth.service';
import { Permissions } from '@app/shared/enums/permissions';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { FullCalendarModule, FullCalendarComponent } from '@fullcalendar/angular';
import { ServerDropdownComponent } from '@shared/components/server-dropdown/server-dropdown.component';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SocketService } from '@app/services/socket.service';

interface Holiday {
  id?: number;
  start_date: string;
  end_date?: string;
  type_id: number | null;
  type: string;
  bonus_mode?: 'DOUBLE' | 'TRIPLE' | 'FIXED' | null;
  bonus_amount?: number | null;
  _readOnly?: boolean;
}

interface HolidayType {
  id: number;
  name: string;
  color: string;
}

@Component({
  selector: 'app-calendar-holiday',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, ServerDropdownComponent],
  templateUrl: './calender-management.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CalenderManagementComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() employee: Employee = new Employee();
  @ViewChild('fullCalendar') fullCalendarRef?: FullCalendarComponent;

  private resizeObserver?: ResizeObserver;

  holidayTypes: HolidayType[] = [];
  newType: HolidayType | null = null;
  typeTitle = '';
  selectedYear: number = new Date().getFullYear();
  selectedMonth: number = new Date().getMonth();
  calendarTypes = Object.values(CalendarType);
  months = Object.values(Month);
  weekDays = Object.values(WeekDays);
  weekendTypes = Object.values(WeekendType);
  holidays: Holiday[] = [];
  years: number[] = [];
  specialDates: { date: string; type: string; color: string; isWeekend: boolean }[] = [];
  newStartDate = '';
  newEndDate = '';
  settingsOpen = false;
  loading = false;
  odata: boolean;
  api: boolean;
  selectedHolidayIndex: number | null = null;
  selectedDate = '';
  selectedBonusIndexes = new Set<number>();
  bonusDialogOpen = false;
  bonusModeDraft: 'NONE' | 'DOUBLE' | 'TRIPLE' | 'FIXED' = 'NONE';
  bonusAmountDraft: number | null = null;
  setBonusButton = $localize`Set Bonus`;
  calendarTitle = $localize`Calendar`;
  settingsTitle = $localize`Calendar Settings`;
  addHolidayButton = $localize`Apply Selected Dates`;
  addHolidayValidationMessage = '';
  startDateValueState: ValueState = ValueState.None;
  holidayTypeValueState: ValueState = ValueState.None;
  applyWeekend = $localize`Apply Weekend`;
  saveButton = $localize`Save`;
  currentHoliday = $localize`Current Holidays`;
  calendarType: string = 'Indivdual';
  showDeptEmployee = true;
  /** Bulk-save target list, managed by the settings dialog's multi-select employee picker.
   * Seeded from `employee` (the toolbar's single-select) whenever it changes; the dialog can
   * add more on top for a bulk apply-to-many save. */
  selectedEmployees: Employee[] = [];
  weekendOptions: { id: string; label: string; dayOfWeek: string; checked: boolean }[] = [];
  weekendHolidays: Holiday[] = [];
  applyScope: WeekendType = WeekendType.ENTIRE_YEAR;
  offDayYear: number = new Date().getFullYear();
  offDayMonth: number = new Date().getMonth();
  individualTab: 'Holiday' | 'OffDay' = 'Holiday';

  public permissions = Permissions;

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: false,
    height: '100%',
    editable: false,
    selectable: false,
    fixedWeekCount: false,
    dayMaxEvents: 2,
    moreLinkClassNames: ['text-[10px]', 'font-semibold', 'text-[var(--sapLink_Color,#0854a0)]', 'no-underline', 'px-1'],
    dateClick: (info) => this.onCalendarDayClick(info.dateStr),
    initialDate: new Date(this.selectedYear, this.selectedMonth, 1),
    datesSet: (info) => {
      const d = info.view.currentStart;
      this.selectedMonth = d.getMonth();
      this.selectedYear = d.getFullYear();
    },
    dayHeaderDidMount: (info) => {
      info.el.classList.add('bg-[var(--sapList_HeaderBackground,#f8fafc)]');
      const cushion = info.el.querySelector('.fc-col-header-cell-cushion') as HTMLElement | null;
      cushion?.classList.add('text-[10px]', 'font-bold', 'uppercase', 'tracking-[0.18em]', 'text-[var(--sapContent_LabelColor,#64748b)]', 'no-underline', 'block', 'py-2.5');
    },
    eventContent: (arg) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'flex items-center gap-1 px-1 py-[1px] overflow-hidden';
      const dot = document.createElement('span');
      dot.className = 'w-[6px] h-[6px] rounded-full shrink-0';
      dot.style.backgroundColor = arg.event.backgroundColor || arg.event.borderColor || '#808080';
      const label = document.createElement('span');
      label.className = 'text-[10px] font-medium text-[var(--sapTextColor,#1d2d3e)] truncate';
      label.textContent = arg.event.title;
      wrapper.append(dot, label);
      return { domNodes: [wrapper] };
    },
  };

  constructor(
    public rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
    private host: ElementRef<HTMLElement>,
    private ngZone: NgZone,
    private authService: AuthService,
    private socketService: SocketService,
    private destroyRef: DestroyRef,
  ) {
    this.odata = commonService.odata;
    this.api = commonService.api;
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.ngZone.run(() => this.fullCalendarRef?.getApi().updateSize());
    });
    this.resizeObserver.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  ngOnInit(): void {
    this.loading = true;
    this.generateYearOptions();
    this.weekendOptions = this.weekDays.map((day) => ({
      id: day,
      label: day,
      dayOfWeek: day,
      checked: false,
    }));
    setTimeout(() => {
      this.fetchHolidayType()
        .then(() => this.selectLoggedInEmployeeByDefault())
        .then(() => {
          this.loadAllData();
          this.loading = false;
        });
    }, 1000);
  }

  private selectLoggedInEmployeeByDefault(): Promise<void> {
    if (this.calendarType === 'Industrial' || this.employee?.id) {
      return Promise.resolve();
    }
    const userId = this.authService.user()?.id;
    if (!userId) return Promise.resolve();

    return new Promise((resolve) => {
      this.commonService.get(`Employees?$filter=user_id eq ${userId}`, this.odata).subscribe({
        next: (res: any) => {
          const first = res?.value?.[0];
          if (first) {
            const employee = new Employee().deserialize(first);
            this.employee = employee;
            this.selectedEmployees = [employee];
          }
          resolve();
        },
        error: (err) => {
          console.error(err);
          resolve();
        },
      });
    });
  }

  onApplyScopeChange(event: any) {
    this.applyScope = event.detail.selectedOption.value as WeekendType;
    this.selectedMonth = new Date().getMonth();
  }

  onCalendarTypeChange(event: any) {
    this.calendarType = event.detail.selectedOption.textContent.trim();
    this.showDeptEmployee = this.calendarType !== 'Industrial';
    this.holidays = this.calendarType === 'Industrial' ? [] : [...this.weekendHolidays];
    this.updateSpecialDates();
    this.selectLoggedInEmployeeByDefault().then(() => this.loadAllData());
  }

  employeeLabelFn = (item: any) =>
    `${item.employee_no} - ${item.first_name} ${item.last_name || ''}`.trim();

  /** Toolbar picker (single-select) — switching employee here also resets the dialog's
   * bulk-save target list to just this one employee. */
  onEmployeeSelect(item: any) {
    this.employee = item ? new Employee().deserialize(item) : new Employee();
    this.selectedEmployees = this.employee.id ? [this.employee] : [];
    this.selectedMonth = new Date().getMonth();
    this.selectedHolidayIndex = null;
    this.updateSpecialDates();
    if (this.calendarType !== 'Industrial') {
      this.loadEmployeeWeekends();
    }
  }

  /** Settings dialog picker (multi-select) — drives the bulk-save target list; the first
   * pick also becomes the previewed/edited `employee` whose calendar draft is shown. */
  onEmployeeMultiSelectChange(items: any[]) {
    this.selectedEmployees = (items ?? []).map((item) => new Employee().deserialize(item));
    this.employee = this.selectedEmployees[0] ? new Employee().deserialize(this.selectedEmployees[0]) : new Employee();
    this.selectedMonth = new Date().getMonth();
    this.selectedHolidayIndex = null;
    this.updateSpecialDates();
    if (this.calendarType !== 'Industrial') {
      this.loadEmployeeWeekends();
    }
  }

  get employeeDisplayValue(): string {
    return this.employee?.id ? this.employeeLabelFn(this.employee) : '';
  }

  generateYearOptions(): void {
    const current = new Date().getFullYear();
    this.years = Array.from({ length: 2 }, (_, i) => current + i);
  }

  updateSpecialDates() {
    this.specialDates = this.holidays.map((item) => {
      const typeUpper = (item.type ?? '').toUpperCase().replace(/\s+/g, '_');
      const isWeekend = !item.type_id && typeUpper === 'WEEKEND';
      const holidayType = item.type_id
        ? this.holidayTypes.find((t) => Number(t.id) === Number(item.type_id))
        : this.holidayTypes.find((t) => t.name.toUpperCase().replace(/\s+/g, '_') === typeUpper);
      const bonusLabel = this.bonusLabel(item);
      return {
        date: item.start_date,
        type: bonusLabel ? `${holidayType?.name ?? item.type ?? 'WEEKEND'} (${bonusLabel})` : (holidayType?.name ?? item.type ?? 'WEEKEND'),
        color: holidayType?.color ?? '#808080',
        isWeekend,
      };
    });
    this.refreshCalendarEvents();
  }

  private refreshCalendarEvents() {
    const api = this.fullCalendarRef?.getApi();
    if (!api) return;
    api.removeAllEvents();
    this.specialDates.forEach((d) => {
      api.addEvent({
        start: d.date,
        allDay: true,
        title: d.type,
        backgroundColor: d.color,
        borderColor: d.color,
      });
    });
  }

  private toUpperSnake(s: string): string {
    return (s ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  }

  fetchHolidayType(): Promise<void> {
    return new Promise((resolve) => {
      this.commonService.get('HolidayTypes', this.odata).subscribe({
        next: (res: any) => {
          this.holidayTypes = res.value ?? [];
          this.newType = null;
          resolve();
        },
        error: (err) => console.error('Error fetching holiday types:', err),
      });
    });
  }

  onNewTypeChange(event: any) {
    const holidayType = this.holidayTypes.find((t) => t.name === event.detail.item?.text);
    if (holidayType) {
      this.newType = holidayType;
      this.typeTitle = holidayType.name;
      this.holidayTypeValueState = ValueState.None;
    }
  }

  getHolidayTypeName(type_id: number | null): string {
    return this.holidayTypes.find((t) => t.id === type_id)?.name ?? 'WEEKEND';
  }

  getSpecialDateColor(dateString: string): string {
    return this.specialDates.find((item) => item.date === dateString)?.color ?? '';
  }

  addHolidayFromDialog(_event: any) {
    if (!this.validateAddHolidayForm()) {
      return;
    }
    const start = new Date(this.newStartDate);
    const end = this.newEndDate ? new Date(this.newEndDate) : start;
    let current = new Date(start);
    while (current <= end) {
      const dateStr = this.DateFromat(current);
      const alreadyExists = this.holidays.some(
        (item) => item.start_date === dateStr && Number(item.type_id) === Number(this.newType!.id),
      );
      if (!alreadyExists) {
        this.holidays.push({
          start_date: dateStr,
          end_date: dateStr,
          type_id: this.newType!.id,
          type: this.newType!.name,
        });
      }
      current.setDate(current.getDate() + 1);
    }
    this.updateSpecialDates();
    this.newStartDate = '';
    this.newEndDate = '';
    this.newType = null;
    this.typeTitle = '';
    this.addHolidayValidationMessage = '';
  }

  private validateAddHolidayForm(): boolean {
    this.startDateValueState = this.newStartDate ? ValueState.None : ValueState.Negative;
    this.holidayTypeValueState = this.newType ? ValueState.None : ValueState.Negative;

    if (!this.newStartDate && !this.newType) {
      this.addHolidayValidationMessage = $localize`Select a start date and holiday type before applying.`;
    } else if (!this.newStartDate) {
      this.addHolidayValidationMessage = $localize`Select a start date before applying.`;
    } else if (!this.newType) {
      this.addHolidayValidationMessage = $localize`Select a holiday type before applying.`;
    } else {
      this.addHolidayValidationMessage = '';
    }

    return !!this.newStartDate && !!this.newType;
  }

  loadAllData() {
    this.loading = true;
    if (this.calendarType === 'Industrial') {
      this.commonService.get(`hrm/employee-weekends?is_industrial=1&year=${this.selectedYear}`, this.api).subscribe({
        next: (res: any) => {
          this.holidays = (res || [])
            .filter((item: any) => item.type !== 'LEAVE')
            .map((item: any) => {
              const date = new Date(item.weekend_date);
              const typeUpper = (item.type ?? '').toUpperCase().replace(/\s+/g, '_');
              const holidayType = this.holidayTypes.find(
                (t) => t.name.toUpperCase().replace(/\s+/g, '_') === typeUpper,
              );
              return {
                start_date: this.DateFromat(date),
                end_date: this.DateFromat(date),
                type: holidayType?.name ?? item.type ?? '',
                type_id: holidayType?.id ?? null,
                bonus_mode: item.bonus_mode ?? null,
                bonus_amount: item.bonus_amount ?? null,
              };
            });
          this.updateSpecialDates();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error fetching industrial weekends:', err);
          this.loading = false;
        },
      });
    } else {
      this.loadEmployeeWeekends();
    }
  }

  applyWeekendConfig() {
    const payload = {
      year: this.offDayYear,
      months: this.applyScope === 'Entire Year' ? this.months : [this.months[this.offDayMonth]],
      weekend_days: this.weekendOptions.filter((opt) => opt.checked).map((opt) => opt.dayOfWeek),
      type: 'WEEKEND',
    };

    this.holidays = this.holidays.filter((item) => {
      if (item.type !== payload.type) return true;
      return new Date(item.start_date).getFullYear() !== payload.year;
    });

    if (payload.weekend_days.length) {
      payload.months.forEach((month) => {
        const monthIndex = this.months.indexOf(month);
        const daysInMonth = new Date(payload.year, monthIndex + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(payload.year, monthIndex, day);
          const weekday = date.toLocaleString('en-US', { weekday: 'short' });
          if (!payload.weekend_days.includes(weekday)) continue;
          const dateStr = this.DateFromat(date);
          const exists = this.holidays.some((h) => h.start_date === dateStr && h.type === payload.type);
          if (!exists) {
            this.holidays.push({ employee_id: this.employee.id, start_date: dateStr, end_date: dateStr, type: payload.type } as any);
          }
        }
      });
    }

    this.updateSpecialDates();
  }

  loadEmployeeWeekends() {
    if (!this.employee?.id) {
      this.weekendHolidays = [];
      this.holidays = [];
      this.loading = false;
      return;
    }
    const employeeId = Number(this.employee.id);
    this.loading = true;
    forkJoin([
      this.commonService.get(`hrm/employee-weekends?employee_id=${employeeId}&year=${this.selectedYear}`, this.api),
      this.commonService.get(`hrm/holidays?year=${this.selectedYear}`, this.api),
      this.commonService.get(`EmployeeHolidaySwaps?$filter=employee_id eq ${employeeId} and type eq 'WEEKEND'`),
    ]).subscribe({
      next: ([weekendsRes, holidaysRes, swapsRes]: [any, any, any]) => {
        this.weekendHolidays = (weekendsRes || [])
          .filter((item: any) => item.type !== 'LEAVE')
          .map((item: any) => {
            const date = new Date(item.weekend_date);
            return {
              employee_id: this.employee.id,
              start_date: this.DateFromat(date),
              end_date: this.DateFromat(date),
              type: item.type,
              type_id: item.type_id ?? null,
              bonus_mode: item.bonus_mode ?? null,
              bonus_amount: item.bonus_amount ?? null,
            };
          });

        this.syncWeekendOptionsWithData(this.weekendHolidays);

        const swaps = swapsRes?.value ?? [];
        const swappedWeekendHolidays = this.weekendHolidays.map((holiday) => {
          const swap = swaps.find((s: any) => s.original_holiday_date === holiday.start_date);
          return swap
            ? { ...holiday, start_date: swap.swapped_holiday_date, end_date: swap.swapped_holiday_date }
            : holiday;
        });

        const industrialHolidays: Holiday[] = (holidaysRes || []).map((item: Holiday) => ({
          ...item,
          type: this.holidayTypes.find((t) => t.id === item.type_id)?.name || '',
          _readOnly: true,
        }));
        this.holidays = [...swappedWeekendHolidays, ...industrialHolidays];
        this.updateSpecialDates();
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      },
    });
  }

  private syncWeekendOptionsWithData(weekendHolidays: Holiday[]) {
    const dayMap: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
    this.weekendOptions.forEach((opt) => (opt.checked = false));
    weekendHolidays.forEach((wh) => {
      const key = dayMap[new Date(wh.start_date).getDay()];
      const opt = this.weekendOptions.find((o) => o.dayOfWeek === key);
      if (opt) opt.checked = true;
    });
  }

  removeHoliday(index: number) {
    if (index < 0 || index >= this.holidays.length) return;
    this.holidays.splice(index, 1);
    this.selectedHolidayIndex = null;
    this.selectedBonusIndexes.delete(index);
    this.updateSpecialDates();
  }

  bonusLabel(holiday: Holiday): string {
    if (holiday.bonus_mode === 'DOUBLE') return $localize`2x`;
    if (holiday.bonus_mode === 'TRIPLE') return $localize`3x`;
    if (holiday.bonus_mode === 'FIXED') return `${holiday.bonus_amount ?? 0}`;
    return '';
  }

  toggleBonusSelection(index: number, event: Event): void {
    event.stopPropagation();
    if (this.selectedBonusIndexes.has(index)) {
      this.selectedBonusIndexes.delete(index);
    } else {
      this.selectedBonusIndexes.add(index);
    }
  }

  get isAllHolidaysSelected(): boolean {
    return this.holidays.length > 0 && this.selectedBonusIndexes.size === this.holidays.length;
  }

  toggleSelectAllHolidays(): void {
    if (this.isAllHolidaysSelected) {
      this.selectedBonusIndexes.clear();
    } else {
      this.selectedBonusIndexes = new Set(this.holidays.map((_, i) => i));
    }
  }

  removeSelectedHolidays(): void {
    if (!this.selectedBonusIndexes.size) return;
    [...this.selectedBonusIndexes]
      .sort((a, b) => b - a)
      .forEach((index) => this.holidays.splice(index, 1));
    this.selectedBonusIndexes.clear();
    this.selectedHolidayIndex = null;
    this.updateSpecialDates();
  }

  openBonusDialog(): void {
    if (!this.selectedBonusIndexes.size) return;
    const first = this.holidays[[...this.selectedBonusIndexes][0]];
    this.bonusModeDraft = first?.bonus_mode ?? 'NONE';
    this.bonusAmountDraft = first?.bonus_amount ?? null;
    this.bonusDialogOpen = true;
  }

  closeBonusDialog(): void {
    this.bonusDialogOpen = false;
  }

  onBonusModeChange(event: any): void {
    const mode = event.detail?.item?.id;
    if (mode === 'NONE' || mode === 'DOUBLE' || mode === 'TRIPLE' || mode === 'FIXED') {
      this.bonusModeDraft = mode;
    }
  }

  applyBonusToSelected(): void {
    const mode = this.bonusModeDraft === 'NONE' ? null : this.bonusModeDraft;
    const amount = mode === 'FIXED' ? this.bonusAmountDraft : null;

    this.selectedBonusIndexes.forEach((index) => {
      const holiday = this.holidays[index];
      if (!holiday) return;
      holiday.bonus_mode = mode;
      holiday.bonus_amount = amount;
    });

    this.selectedBonusIndexes.clear();
    this.bonusDialogOpen = false;
  }

  /**
   * hrm/employee-weekends/bulk runs on node-server (EmployeeWeekendsService)
   * — applying an industrial calendar to "all active" employees could mean
   * thousands of rows in one request, which was timing out / hitting DB
   * packet limits when this lived in Laravel. The sync now runs in the
   * background there and reports progress directly over the same socket the
   * browser already connects to; this POST returns immediately with a
   * job_id instead of the UI waiting on — or failing on — one giant HTTP
   * round trip.
   */
  private watchBulkWeekendsJob(jobId: string | undefined): void {
    this.loading = false;
    this.settingsOpen = false;

    if (!jobId) {
      this.toastService.show('error');
      return;
    }

    // Dialog is already closed at this point — the sync keeps running in the
    // background, surfaced only as a persistent toast that updates in place
    // as progress events arrive, until a final (non-persist) toast replaces
    // it on completion/failure.
    this.toastService.show('save', $localize`Syncing calendar to employees…`, true);

    this.socketService
      .on('hrm-bulk-weekends:progress')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: { job_id: string; status: string; processed: number; total: number }) => {
        if (payload.job_id !== jobId) return;

        if (payload.status === 'completed') {
          this.selectedHolidayIndex = null;
          this.loadAllData();
          this.toastService.show('save', $localize`Calendar synced to ${payload.total} employee(s).`);
        } else if (payload.status === 'failed') {
          this.toastService.show('error', $localize`Failed to sync calendar to employees.`);
        } else {
          this.toastService.show('save', $localize`Syncing calendar… ${payload.processed}/${payload.total} employees`, true);
        }
      });
  }

  saveAllChanges() {
    this.loading = true;

    if (this.calendarType === 'Industrial') {
      const data = this.holidays.map((item) => ({
        start_date: item.start_date,
        end_date: item.end_date ?? item.start_date,
        type: this.toUpperSnake(item.type || this.holidayTypes.find((t) => t.id === item.type_id)?.name || 'HOLIDAY'),
        type_id: item.type_id,
        bonus_mode: item.bonus_mode ?? null,
        bonus_amount: item.bonus_amount ?? null,
      }));
      this.commonService
        .post(
          'hrm/employee-weekends/bulk',
          { all_active: true, data, year: this.selectedYear },
          false,
          undefined,
          undefined,
          true,
        )
        .subscribe({
          next: (res: any) => this.watchBulkWeekendsJob(res?.job_id),
          error: (err) => {
            console.error(err);
            this.toastService.show('error');
            this.loading = false;
          },
        });
    } else {
      const data = this.holidays
        .filter((item) => !item._readOnly)
        .map((item) => ({
          ...item,
          type: this.toUpperSnake(item.type || this.holidayTypes.find((t) => t.id === item.type_id)?.name || 'HOLIDAY'),
        }));

      // A single selected employee keeps the original sync-based single-employee save;
      // multiple selected employees apply the same holiday/weekend set to all of them
      // via the bulk endpoint (also used for Industrial's "all active" apply).
      const isBulk = this.selectedEmployees.length > 1;
      const request$ = isBulk
        ? this.commonService.post(
            'hrm/employee-weekends/bulk',
            { employee_ids: this.selectedEmployees.map((e) => Number(e.id)), data, year: this.selectedYear },
            false,
            undefined,
            undefined,
            true,
          )
        : this.commonService.post(
            'hrm/employee-weekends',
            { employee_id: this.employee.id, data, year: this.selectedYear, sync: true },
            this.api,
          );

      request$.subscribe({
        next: (res: any) => {
          if (isBulk) {
            this.watchBulkWeekendsJob(res?.job_id);
            return;
          }
          this.loadAllData();
          this.toastService.show('save');
          this.settingsOpen = false;
        },
        error: (err) => {
          console.error(err);
          this.toastService.show('error');
          this.loading = false;
        },
      });
    }
  }

  get currentMonthYearLabel(): string {
    return `${this.months[this.selectedMonth]} ${this.selectedYear}`;
  }

  get legendTypes(): { name: string; color: string }[] {
    const base = this.holidayTypes.map((t) => ({ name: t.name, color: t.color }));
    const knownNames = new Set(this.holidayTypes.map((t) => t.name.toUpperCase()));
    const extra: { name: string; color: string }[] = [];
    const seenExtra = new Set<string>();
    for (const d of this.specialDates) {
      const key = d.type.toUpperCase();
      if (!d.type || knownNames.has(key) || seenExtra.has(key)) continue;
      seenExtra.add(key);
      extra.push({ name: d.type, color: d.color });
    }
    return [...base, ...extra];
  }

  prevMonth() { this.fullCalendarRef?.getApi().prev(); }
  nextMonth() { this.fullCalendarRef?.getApi().next(); }
  goToday()   { this.fullCalendarRef?.getApi().today(); }

  onOffDayYearChange(event: Event) {
    this.offDayYear = +(event as CustomEvent).detail.selectedOption.value;
  }

  onOffDayMonthChange(event: Event) {
    this.offDayMonth = +(event as CustomEvent).detail.selectedOption.value;
  }

  openSettings()  { this.settingsOpen = true; }
  closeSettings() { this.settingsOpen = false; }

  onStartDateChange(event: Event) {
    this.newStartDate = (event as CustomEvent).detail.value;
    this.startDateValueState = this.newStartDate ? ValueState.None : ValueState.Negative;
  }
  onEndDateChange(event: Event)   { this.newEndDate   = (event as CustomEvent).detail.value; }

  onCalendarDayClick(dateString: string) {
    this.newStartDate = dateString;
    this.newEndDate = dateString;
    this.selectedHolidayIndex = null;
    this.selectedDate = dateString;
    this.settingsOpen = true;
  }

  addHoliday(event: MouseEvent, date: Date): void {
    event.stopPropagation();
    this.onCalendarDayClick(date.toISOString().slice(0, 10));
  }

  DateFromat(date: Date): string {
    return this.dateFormatter
      .formatDate(date, false, false, false, false, false)
      .split('/')
      .reverse()
      .join('-');
  }
}
