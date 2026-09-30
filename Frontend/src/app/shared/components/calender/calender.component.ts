import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectorRef,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import moment from 'moment';
import { ThemeService } from '@app/services/theme.service';

export interface SpecialDate {
  date: string;
  type: string;
  color: string;
  isWeekend: boolean;
}

interface CalendarDay {
  dateStr: string;
  dayNum: number | null;
  isEmpty: boolean;
  isToday: boolean;
  isWeekend: boolean;
  specialData: SpecialDate | null;
  isSelected: boolean;
  isPreSelected: boolean;
  isDisabled: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [Ui5MainModule, CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent implements OnInit, OnChanges {
  @Input() size: 'small' | 'large' = 'large';
  @Input() employee: any;
  @Input() specialDates: SpecialDate[] = [];
  @Input() updateCalender: EventEmitter<string[]> = new EventEmitter<string[]>();
  @Input() preSelectedDates: string[] = [];
  @Input() disabledDates: string[] = [];
  @Output() selectedDatesChange = new EventEmitter<string[]>();

  selectedDates: string[] = [];
  currentDate = moment();
  year: number = this.currentDate.year();
  month: number = this.currentDate.month();
  displayMonth: string = '';
  displayYear: string = '';
  weekDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  days: CalendarDay[] = [];

  constructor(private cdr: ChangeDetectorRef,public theme : ThemeService) {}

  ngOnInit() {
    this.selectedDates = [...this.preSelectedDates];
    this.syncViewWithSelectedDates(this.preSelectedDates);
    this.generateCalendar();

    if (this.updateCalender) {
      this.updateCalender.subscribe((data) => {
        this.preSelectedDates = data || [];
        this.selectedDates = [...this.preSelectedDates];
        this.syncViewWithSelectedDates(this.preSelectedDates);
        this.generateCalendar();
        this.cdr.detectChanges();
      });
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['preSelectedDates'] && !changes['preSelectedDates'].firstChange) {
      this.syncViewWithSelectedDates(this.preSelectedDates);
    }
    if (changes['specialDates'] && !changes['specialDates'].firstChange) {
      this.generateCalendar();
    }
  }

  private syncViewWithSelectedDates(dates: string[] = []) {
    if (!dates.length) {
      const today = moment();
      this.year = today.year();
      this.month = today.month();
      return;
    }

    const firstSelectedDate = moment(dates[0], 'YYYY-MM-DD', true);
    if (!firstSelectedDate.isValid()) {
      return;
    }

    this.year = firstSelectedDate.year();
    this.month = firstSelectedDate.month();
  }

  generateCalendar() {
    const m = moment([this.year, this.month]);
    this.displayMonth = this.size === 'large'
      ? m.format('MMMM')
      : m.format('MM');

    this.displayYear = m.format('YYYY');
    this.days = [];
    const startOfMonth = m.clone().startOf('month');
    const daysInMonth = m.daysInMonth();
    const startDayOfWeek = startOfMonth.day();

    for (let i = 0; i < startDayOfWeek; i++) {
      this.days.push(this.createEmptyDay());
    }

    const todayStr = moment().format('YYYY-MM-DD');
    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = m.clone().date(i);
      const dateStr = dateObj.format('YYYY-MM-DD');
      const specialInfo = this.specialDates.find(
        specialDate => specialDate.date === dateStr
      );

      this.days.push({
        dateStr,
        dayNum: i,
        isEmpty: false,
        isWeekend: specialInfo ? specialInfo.isWeekend : false,
        specialData: specialInfo || null,
        isToday: dateStr === todayStr,
        isSelected: this.selectedDates.includes(dateStr),
        isDisabled: this.disabledDates.includes(dateStr),

        isPreSelected: false
      });
    }

    const remaining = 7 - (this.days.length % 7);
    if (remaining < 7) {
      for (let i = 0; i < remaining; i++) {
        this.days.push(this.createEmptyDay());
      }
    }
  }

  createEmptyDay(): CalendarDay {
    return {
      dateStr: '',
      dayNum: null,
      isEmpty: true,
      isWeekend: false,
      isToday: false,
      specialData: null,
      isSelected: false,
      isPreSelected: false,
      isDisabled: false
    };
  }

  prevMonth() {
    const month = moment([this.year, this.month]).subtract(1, 'month');
    this.year = month.year();
    this.month = month.month();
    this.generateCalendar();
  }

  nextMonth() {
    const month = moment([this.year, this.month]).add(1, 'month');
    this.year = month.year();
    this.month = month.month();
    this.generateCalendar();
  }

  goToToday() {
    const today = moment();
    this.year = today.year();
    this.month = today.month();
    this.generateCalendar();
  }

  toggleDate(day: CalendarDay) {
    if (this.size === 'large') return;
    if (day.isEmpty || day.isDisabled) return;

    day.isSelected = !day.isSelected;

    if (day.isSelected) {
      this.selectedDates.push(day.dateStr);
    } else {
      this.selectedDates = this.selectedDates.filter(
        selectedDate => selectedDate !== day.dateStr
      );
    }

    this.selectedDatesChange.emit(this.selectedDates);
  }

}
