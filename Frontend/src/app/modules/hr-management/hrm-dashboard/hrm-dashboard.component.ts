import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { Localization } from '@shared/utilities/localization';
import { DailyAttendanceListComponent } from '@app/modules/hr-management/employee-attendance/daily-attendance-list/daily-attendance-list.component';
import moment from 'moment';
import { ThemeService } from '@app/services/theme.service';
import { Department } from '@app/shared/model/department';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import { ShiftResolverService } from '@app/modules/hr-management/shared/services/shiftResolver.service';
@Component({
  selector: 'app-hrm-dashboard',
  templateUrl: './hrm-dashboard.component.html',
})
export class HrmDashboardComponent implements OnInit, OnDestroy {
  @ViewChild('attendanceRef') attendanceComp!: DailyAttendanceListComponent;
  @ViewChild('dateRangePicker') dateRangePickerRef: any;
  @ViewChild('departmentCombo') departmentComboRef: any;
  employeeAttendanceData: { date: string; presentEmployees: number }[] = [];
  expenseBreakdown: { category: string; amount: number }[] = [];
  employeeCount: number = 0;
  leaveTodayCount: number = 0;
  presentCount: number = 0;
  absentCount: number = 0;
  totalOverTime: number = 0;
  shiftEmployeeCount: number = 0;
  totalInShift: number = 0;
  totalShiftPresent: number = 0;
  totalAbsentInShift: number = 0;
  lateCount: number = 0;
  departments: Department[] = [];
  departmentName = '';
  selectedShiftName = '';
  departmentId: string | null = null;
  public localization = Localization;
  start = moment().subtract(1, 'month').format('YYYY-MM-DD');
  end = moment().format('YYYY-MM-DD');
  momentInstance = moment;
  currentDate = moment().format('DD-MM-YYYY');
  dateRangeValue = `${moment().subtract(1, 'month').format('DD/MM/YYYY')} - ${moment().format('DD/MM/YYYY')}`;
  currentShift: EmployeeShift | null = null;
  EmployeeShifts : EmployeeShift[] = [];

  shiftId: number = 0;

  payrollDatasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
  }[] = [];

  payrollNutItems: {
    label: string;
    value: number;
    color?: string;
  }[] = [];
  payrollOutstanding = 0;
  payrollTotalSalary = 0;
  payrollPayableDays = 0;
  payrollGenerated = 0;
  deptLabels: string[] = [];
  deptData: number[] = [];
  public loading = true;
  public refreshing = false;
  private pendingRequests = 3;
  private pendingRefreshRequests = 0;
  private shiftAutoSelectTimer?: ReturnType<typeof setInterval>;
  private timeBasedShiftId = 0;

  leaveLabels: string[] = [];
  leaveDatasets = [
    {
      label: 'Assets Issued',
      data: [],
      backgroundColor: '#f59e0b',
    },
  ];

  constructor(
    private commonServices: CommonService,
    public theme: ThemeService,
    private shiftResolverService: ShiftResolverService,
  ) {}

  ngOnInit(): void {
    this.getShift();
    this.loadDashboardAnalytics();
    this.initDepartment();
    this.shiftAutoSelectTimer = setInterval(() => {
      this.autoSelectShiftByCurrentTime();
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.shiftAutoSelectTimer) {
      clearInterval(this.shiftAutoSelectTimer);
    }
  }

  async getShift() {
    try {
      this.currentShift = await this.shiftResolverService.resolveCurrentShift();
      this.selectedShiftName = this.currentShift?.name || '';
      this.shiftId = this.currentShift?.id || 0;
      this.timeBasedShiftId = this.shiftId;
      this.EmployeeShifts = this.shiftResolverService.shifts;
      this.loadTodaySummary(this.shiftId);
    } catch (err) {
      console.error('Failed to resolve current shift:', err);
      this.loadTodaySummary(0);
    }
  }

  private async autoSelectShiftByCurrentTime() {
    const currentShift = await this.shiftResolverService.resolveCurrentShift();
    const currentShiftId = currentShift?.id || 0;

    if (currentShiftId === this.timeBasedShiftId) {
      return;
    }

    this.timeBasedShiftId = currentShiftId;
    this.currentShift = currentShift;
    this.selectedShiftName = currentShift?.name || '';
    this.shiftId = currentShiftId;
    this.loadTodaySummary(this.shiftId);
  }
  dateRangePickerChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value) return;

    const [startDate, endDate] = value.split(' - ');
    this.start = moment
      .utc(startDate, 'DD/MM/YYYY')
      .startOf('day')
      .format('YYYY-MM-DD');
    this.end = moment
      .utc(endDate, 'DD/MM/YYYY')
      .endOf('day')
      .format('YYYY-MM-DD');
    this.dateRangeValue = value;
  }

  getDepartment(items: any) {
    const selectedItem = items.detail.item;
    if (selectedItem) {
      this.departmentName = selectedItem.text;
      this.departmentId = selectedItem.id;
    } else {
      this.departmentName = '';
      this.departmentId = null;
    }
  }
  initDepartment() {
    this.commonServices.get('Departments?$filter=is_active eq true').subscribe({
      next: (res: any) => {
        this.departments = res.value;
        this.markRequestComplete();
      },
      error: (err) => {
        console.error(err);
        this.markRequestComplete();
      },
    });
  }
  loadDashboardAnalytics(trackRefresh = false) {
    if (!this.start || !this.end) return;

    const params = new URLSearchParams({
      start: this.start,
      end: this.end,
    });

    if (this.departmentId) {
      params.set('department_id', this.departmentId);
    }

    this.commonServices
      .get(`hrm/analytics/dashboard?${params.toString()}`, false)
      .subscribe({
        next: (res: any) => {
          const data = res?.data ?? {};
          const payroll = data?.payroll ?? { bar: [], totals: {} };
          const bar = payroll?.bar ?? [];
          const overview = payroll?.overview ?? {
            totalOutstanding: 0,
            totalSalary: 0,
            totalPayableDays: 0,
            totalGenerated: 0,
          };
          const totals = payroll?.totals ?? {
            totalNet: 0,
            totalDeduction: 0,
            totalBonus: 0,
          };
          const assetAnalysis = data?.assetAnalysis ?? {
            labels: [],
            values: [],
          };
          const groupAnalysis = data?.groupAnalysis ?? {
            labels: [],
            values: [],
          };

          this.employeeAttendanceData = data?.attendance ?? [];
          this.expenseBreakdown = data?.leaveSummary ?? [
            { category: 'Approved', amount: 0 },
            { category: 'Pending', amount: 0 },
            { category: 'Rejected', amount: 0 },
          ];

          this.payrollLabels = bar.map((x: any) => x.label);
          this.payrollDatasets = [
            {
              label: 'Total Net Payroll',
              data: bar.map((x: any) => x.totalNet),
              backgroundColor: '#10b981',
            },
          ];
          this.payrollNutItems = [
            { label: 'Bonus', value: totals.totalBonus, color: '#06b6d4' },
            {
              label: 'Deduction',
              value: totals.totalDeduction,
              color: '#ef4444',
            },
          ];
          this.payrollOutstanding = overview?.totalOutstanding ?? 0;
          this.payrollTotalSalary = overview?.totalSalary ?? 0;
          this.payrollPayableDays = overview?.totalPayableDays ?? 0;
          this.payrollGenerated = overview?.totalGenerated ?? 0;

          this.leaveLabels = assetAnalysis?.labels ?? [];
          this.leaveDatasets[0].data = assetAnalysis?.values ?? [];

          this.deptLabels = groupAnalysis?.labels ?? [];
          this.deptData = groupAnalysis?.values ?? [];
          trackRefresh ? this.markRefreshComplete() : this.markRequestComplete();
        },
        error: (err) => {
          console.error('Failed to load dashboard analytics:', err);
          this.employeeAttendanceData = [];
          this.expenseBreakdown = [
            { category: 'Approved', amount: 0 },
            { category: 'Pending', amount: 0 },
            { category: 'Rejected', amount: 0 },
          ];
          this.payrollLabels = [];
          this.payrollDatasets = [
            {
              label: 'Total Net Payroll',
              data: [],
              backgroundColor: '#10b981',
            },
          ];
          this.payrollNutItems = [
            { label: 'Bonus', value: 0, color: '#06b6d4' },
            { label: 'Deduction', value: 0, color: '#ef4444' },
          ];
          this.payrollOutstanding = 0;
          this.payrollTotalSalary = 0;
          this.payrollPayableDays = 0;
          this.payrollGenerated = 0;
          this.leaveLabels = [];
          this.leaveDatasets[0].data = [];
          this.deptLabels = [];
          this.deptData = [];
          trackRefresh ? this.markRefreshComplete() : this.markRequestComplete();
        },
      });
  }

  onShiftChange(event: any) {
    const selectedItem = event.detail.item;
    if (selectedItem) {
      this.selectedShiftName = selectedItem.text;
      this.shiftId = Number(selectedItem.id) || 0;
      this.beginRefresh(1);
      this.loadTodaySummary(selectedItem.id, true);
    } else {
      this.selectedShiftName = '';
      this.shiftId = 0;
    }

  }

  loadTodaySummary(shiftId: number, trackRefresh = false) {
    this.commonServices
      .get(`hrm/analytics/today-summary?shift_id=${shiftId}`, false)
      .subscribe({
        next: (res: any) => {
          const summary = res?.data ?? {};
          const shiftData = res?.['shift-data'] ?? {};
          this.employeeCount = summary?.totalEmployees ?? 0;
          this.presentCount = summary?.presentCount ?? 0;
          this.absentCount = summary?.absentCount ?? 0;
          this.leaveTodayCount = summary?.leaveTodayCount ?? 0;
          this.totalOverTime = shiftData?.totalOverTime ?? 0;
          this.shiftEmployeeCount = shiftData?.shiftEmployeeCount ?? 0;
          this.totalInShift = shiftData?.totalInShift ?? 0;
          this.totalShiftPresent = shiftData?.totalShiftPresent ?? 0;
          this.totalAbsentInShift = shiftData?.totalAbsentInShift ?? 0;
          this.lateCount = shiftData?.lateCount ?? 0;
          trackRefresh ? this.markRefreshComplete() : this.markRequestComplete();
        },
        error: (err) => {
          console.error('Failed to load today summary:', err);
          this.employeeCount = 0;
          this.presentCount = 0;
          this.absentCount = 0;
          this.leaveTodayCount = 0;
          this.totalOverTime = 0;
          this.shiftEmployeeCount = 0;
          this.totalInShift = 0;
          this.totalShiftPresent = 0;
          this.totalAbsentInShift = 0;
          this.lateCount = 0;
          trackRefresh ? this.markRefreshComplete() : this.markRequestComplete();
        },
      });
  }

  applyFilter() {
    this.beginRefresh(1);
    this.loadDashboardAnalytics(true);
  }

  payrollLabels: string[] = [];

  resetFilter() {
    this.start = moment().subtract(1, 'month').format('YYYY-MM-DD');
    this.end = moment().format('YYYY-MM-DD');
    this.dateRangeValue = `${moment(this.start).format('DD/MM/YYYY')} - ${moment(this.end).format('DD/MM/YYYY')}`;
    this.departmentName = '';
    this.departmentId = null;

    if (this.dateRangePickerRef?.nativeElement) {
      this.dateRangePickerRef.nativeElement.value = this.dateRangeValue;
    }

    if (this.departmentComboRef?.nativeElement) {
      this.departmentComboRef.nativeElement.value = '';
    }

    this.beginRefresh(1);
    this.loadDashboardAnalytics(true);
  }
  private markRequestComplete() {
    this.pendingRequests = Math.max(this.pendingRequests - 1, 0);
    this.loading = this.pendingRequests > 0;
  }

  private beginRefresh(count: number) {
    this.pendingRefreshRequests = count;
    this.refreshing = true;
  }

  private markRefreshComplete() {
    this.pendingRefreshRequests = Math.max(this.pendingRefreshRequests - 1, 0);
    if (this.pendingRefreshRequests === 0) this.refreshing = false;
  }
}
