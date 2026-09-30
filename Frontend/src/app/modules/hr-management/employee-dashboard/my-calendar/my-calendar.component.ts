import { AfterViewInit, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { DateFormatterService } from '@app/shared/utilities/date-format';
import { Month } from '@app/modules/hr-management/shared/enums/month';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';

interface CalendarSpecialDate {
  date: string;
  type: string;
  color: string;
  isWeekend: boolean;
}

@Component({
  selector: 'app-my-calendar',
  templateUrl: './my-calendar.component.html',
})
export class MyCalendarComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() employee: any;
  @ViewChild('fullCalendar') fullCalendarRef?: FullCalendarComponent;

  loading = false;
  selectedYear = new Date().getFullYear();
  selectedMonth = new Date().getMonth();
  specialDates: CalendarSpecialDate[] = [];
  holidayTypes: any[] = [];

  private readonly api: boolean;
  private readonly months = Object.values(Month);
  private readonly weekendColor = '#7e7e7eff';
  private readonly holidayColor = '#ff4444ff';
  private visibilityObserver?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: false,
    height: '100%',
    editable: false,
    selectable: false,
    initialDate: new Date(this.selectedYear, this.selectedMonth, 1),
    fixedWeekCount: false,
    expandRows: true,
    dayMaxEvents: 2,
    moreLinkClassNames: ['text-[10px]', 'font-semibold', 'text-[var(--sapLink_Color,#0854a0)]', 'no-underline', 'px-1'],
    datesSet: (info) => {
      const date = info.view.currentStart;
      this.selectedMonth = date.getMonth();
      const year = date.getFullYear();
      if (year !== this.selectedYear) {
        this.selectedYear = year;
        this.loadCalendarData();
      } else {
        this.refreshCalendarEvents();
      }
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
    dayHeaderDidMount: (info) => {
      info.el.classList.add('bg-[var(--sapList_HeaderBackground,#f8fafc)]');
      const cushion = info.el.querySelector('.fc-col-header-cell-cushion') as HTMLElement | null;
      cushion?.classList.add('text-[10px]', 'font-bold', 'uppercase', 'tracking-[0.18em]', 'text-[var(--sapContent_LabelColor,#64748b)]', 'no-underline', 'block', 'py-2.5');
    },
    dayCellDidMount: (info) => {
      const frame = info.el.querySelector('.fc-daygrid-day-frame') as HTMLElement | null;
      if (!frame) return;
      frame.classList.add('relative', 'p-3');
      const number = frame.querySelector('.fc-daygrid-day-number') as HTMLElement | null;
      if (!number) return;
      number.classList.add('text-[13px]', 'leading-none', 'no-underline');
      if (info.isOther) {
        number.classList.add('opacity-30');
      }
      if (info.isToday) {
        number.classList.add('bg-[var(--sapButton_Emphasized_Background,#0854a0)]', 'text-[var(--sapButton_Emphasized_TextColor,#fff)]', 'rounded-full', 'w-[26px]', 'h-[26px]', 'flex', 'items-center', 'justify-center', 'font-bold', 'm-[5px_8px]', 'p-0');
      } else {
        number.classList.add('px-2.5', 'py-1.5', 'font-medium', 'text-[var(--sapTextColor,#1d2d3e)]');
      }
    },
  };

  constructor(
    private commonService: CommonService,
    private dateFormatter: DateFormatterService,
    private host: ElementRef<HTMLElement>,
    private ngZone: NgZone,
  ) {
    this.api = commonService.api;
  }

  ngOnInit(): void {
    this.loadCalendarData();
  }

  ngAfterViewInit(): void {
    // Override FullCalendar's default yellow today-highlight and white cell background with SAP theme tokens.
    this.host.nativeElement.style.setProperty('--fc-today-bg-color', 'var(--sapList_SelectionBackgroundColor, #eef2ff)');
    this.host.nativeElement.style.setProperty('--fc-border-color', 'var(--sapList_BorderColor, #d9d9d9)');
    this.host.nativeElement.style.setProperty('--fc-page-bg-color', 'var(--sapGroup_ContentBackground, #fff)');
    this.host.nativeElement.style.setProperty('--fc-neutral-bg-color', 'var(--sapList_HeaderBackground, #f8fafc)');
    this.visibilityObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      this.ngZone.run(() => {
        this.fullCalendarRef?.getApi().updateSize();
        this.refreshCalendarEvents();
      });
    });
    this.visibilityObserver.observe(this.host.nativeElement);

    this.resizeObserver = new ResizeObserver(() => {
      this.ngZone.run(() => this.fullCalendarRef?.getApi().updateSize());
    });
    this.resizeObserver.observe(this.host.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employee'] && !changes['employee'].firstChange) {
      this.loadCalendarData();
    }
  }

  ngOnDestroy(): void {
    this.visibilityObserver?.disconnect();
    this.resizeObserver?.disconnect();
  }

  get currentMonthYearLabel(): string {
    return `${this.months[this.selectedMonth]} ${this.selectedYear}`;
  }

  get legendTypes(): { name: string; color: string }[] {
    const seen = new Set<string>();
    const result: { name: string; color: string }[] = [];
    for (const date of this.specialDates) {
      if (seen.has(date.type)) continue;
      seen.add(date.type);
      result.push({ name: date.type, color: date.color });
    }
    return result;
  }

  prevMonth(): void { this.fullCalendarRef?.getApi().prev(); }
  nextMonth(): void { this.fullCalendarRef?.getApi().next(); }
  goToday(): void { this.fullCalendarRef?.getApi().today(); }

  private loadCalendarData(): void {
    const employeeId = Number(this.employee?.id);
    if (!employeeId) {
      this.specialDates = [];
      this.refreshCalendarEvents();
      return;
    }
    this.loading = true;
    forkJoin([
      this.commonService.get(`hrm/employee-weekends?employee_id=${employeeId}&year=${this.selectedYear}`, this.api),
      this.commonService.get(
        `Employees(${employeeId})?$expand=leaveRequests($filter=final_status eq 'approved';$expand=leaveDates)`,
        true,
      ),
      this.commonService.get('HolidayTypes', true),
      this.commonService.get(
        `EmployeeHolidaySwaps?$filter=employee_id eq ${employeeId} and type eq 'WEEKEND'`,
      ),
    ]).subscribe({
      next: ([weekendsRes, leaveRes, holidayTypesRes, swapsRes]: [any, any, any, any]) => {
        this.holidayTypes = holidayTypesRes?.value ?? [];
        const swaps = swapsRes?.value ?? [];
        const dates: CalendarSpecialDate[] = [];

        (weekendsRes || [])
          .filter((item: any) => item.type !== 'LEAVE')
          .forEach((item: any) => {
            const typeUpper = (item.type ?? '').toUpperCase().replace(/\s+/g, '_');
            const isWeekend = typeUpper === 'WEEKEND';
            const holidayType = this.holidayTypes.find(
              (t: any) => t.name.toUpperCase().replace(/\s+/g, '_') === typeUpper
            );
            const originalDate = this.formatDate(new Date(item.weekend_date));
            const swap = swaps.find((s: any) => s.original_holiday_date === originalDate);
            dates.push({
              date: swap ? swap.swapped_holiday_date : originalDate,
              type: holidayType?.name ?? this.labelFor(item.type),
              color: holidayType?.color ?? (isWeekend ? this.weekendColor : this.holidayColor),
              isWeekend,
            });
          });

        (leaveRes?.leaveRequests || []).forEach((request: any) => {
          if (request.final_status !== 'approved' || !request.leaveDates) return;
          const color = this.getLeaveColor(request.leave_type_id);
          const name = this.getLeaveTypeName(request.leave_type_id);
          request.leaveDates.forEach((dateObj: any) => {
            dates.push({ date: dateObj.leave_date, type: name, color, isWeekend: false });
          });
        });

        this.specialDates = dates;
        this.refreshCalendarEvents();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching calendar data:', err);
        this.loading = false;
      },
    });
  }

  private getLeaveColor(typeId: number): string {
    switch (typeId) {
      case 1: return '#51ad73';
      case 2: return '#749ee2';
      default: return '#f97316';
    }
  }

  private getLeaveTypeName(typeId: number): string {
    switch (typeId) {
      case 1: return 'Medical Leave';
      case 2: return 'Casual Leave';
      default: return 'Leave';
    }
  }

  private refreshCalendarEvents(): void {
    const api = this.fullCalendarRef?.getApi();
    if (!api) return;
    api.removeAllEvents();
    this.specialDates.forEach((date) => {
      api.addEvent({
        start: date.date,
        allDay: true,
        title: date.type,
        backgroundColor: date.color,
        borderColor: date.color,
      });
    });
  }

  private labelFor(type: string): string {
    return (type ?? '')
      .replace(/_/g, ' ')
      .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  private formatDate(date: Date): string {
    return this.dateFormatter
      .formatDate(date, false, false, false, false, false)
      .split('/')
      .reverse()
      .join('-');
  }
}
