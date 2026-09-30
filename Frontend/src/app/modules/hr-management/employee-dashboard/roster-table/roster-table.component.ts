import { Component, Input } from "@angular/core";
import moment from "moment";
import { SHIFTVIEWTYPE } from "@app/shared/enums/shiftViewType";
import { ShiftType } from "@app/modules/hr-management/shared/enums/shiftType";
import { RosterViewType } from "@app/modules/hr-management/shared/enums/rosterViewType";
import { OffDayType } from "@app/modules/hr-management/shared/enums/offDayType";
import { Month } from "@app/modules/hr-management/shared/enums/month";
import { Localization } from "@shared/utilities/localization";
import { CommonService } from "@app/services/common-service/common.service";
import { ThemeService } from "@app/services/theme.service";
@Component({
  selector: "app-roster-table",
  templateUrl: "./roster-table.component.html",
  styleUrl: "./roster-table.component.scss",
})
export class RosterTableComponent {
  @Input() employeeId: number | undefined | null = null;
  localization = Localization;
  ShiftType = ShiftType;
  RosterViewType = RosterViewType;
  OffDayType = OffDayType;
  public weekDates: any[] = [];
  public ViewType: "day" | "week" | "month" = "day";
  public currentWeekStart: moment.Moment = moment().startOf("day");
  public showrosterforDays: number = 1;
  public isLoading: boolean = false;
  public rostersLists: any[] = [];
  public start_date: string = "";
  public end_date: string = "";
  public shiftviewtypes = Object.values(SHIFTVIEWTYPE);
  public employeeviewtypes = Object.values(RosterViewType);
  public months = Object.values(Month);
  public selectedEmployeeView: RosterViewType = RosterViewType.ALL;
  public employees: any[] = [];
  public selectedEmployees: any[] = [];
  public showActionPopover = false;
  public actionPopoverTargetShiftId: number | null = null;
  public currentActionDate: string | null = null;
  public pendingDraggedData: any | null = null;
  public selectedOverridesType: string = "";
  public selectedTargetEmployeeId: null = null;
  shifts: any[] = [];
  moment = moment();
  selectedMonth: any = new Date().getMonth();
  loading: boolean = false;

  constructor(private commonService: CommonService , public theme : ThemeService) {}

  ngOnInit() {
    const now = new Date();
    this.selectedMonth = this.months[now.getMonth()];
    this.showrosterforDays = 7;
    this.currentWeekStart = moment().startOf("week");
    this.updateDatesAndFetch();
    this.getShifts();
  }
  previousWeek() {
    this.currentWeekStart.subtract(this.showrosterforDays, "days");
    this.updateDatesAndFetch();
  }

  nextWeek() {
    this.currentWeekStart.add(this.showrosterforDays, "days");
    this.updateDatesAndFetch();
  }
  updateDatesAndFetch() {
    this.weekDates = [];
    const today = moment().startOf("day");
    for (let i = 0; i < this.showrosterforDays; i++) {
      const day = this.currentWeekStart.clone().add(i, "days");
      this.weekDates.push({
        date: day.date(),
        dayName: day.format("ddd"),
        fullDate: day,
        isToday: day.isSame(today, "day"),
      });
    }
    this.start_date = this.weekDates[0].fullDate.format("YYYY-MM-DD");
    this.end_date =
      this.weekDates[this.weekDates.length - 1].fullDate.format("YYYY-MM-DD");
    this.getRosterForSelectedEmployees();
  }
  getRosterForSelectedEmployees() {
    if (!this.employeeId) return;

    this.isLoading = true;
    this.commonService
      .get(
        `hrm/roster-schedule?start_date=${this.start_date}&end_date=${this.end_date}&all_employees=0&employee_ids[]=${this.employeeId}`,
        false
      )
      .subscribe({
        next: (res: any) => {
          this.rostersLists =
            res.data?.map((day: any) => ({
              date: day.day,
              shifts: day.shifts.filter((shift: any) =>
                shift.employees.some(
                  (employee: any) => employee.employee_details.id === this.employeeId
                )
              ),
            })) || [];

          this.isLoading = false;
        },
        error: (err) => {
          console.error("Error fetching selected employee rosters:", err);
          this.isLoading = false;
        },
      });
  }
  getMaxShiftRows(): number[] {
    const maxRows = Math.max(
      ...this.rostersLists.map((date) => date.shifts.length || 0),
      0
    );
    
    return Array.from({ length: maxRows }, (_, i) => i);
  }

  getShiftForDay(day: any, rowIndex: number) {
    const dayRoster = this.rostersLists.find((d) =>
      moment(d.date).isSame(day.fullDate, "day")
    );
    return dayRoster?.shifts[rowIndex] || null;
  }
  getShifts(){
    this.loading = true;
    this.commonService
      .get(
        `EmployeeShifts?`,
        true
      )
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.shifts = res.value || [];
        },
        error: (err) => {
          console.error("Error fetching shifts data:", err);
          this.loading = false;
        },
      });
  }
    onMonthChange(month: any) {
    this.currentWeekStart = this.moment
      .month(Number(month.detail.item.value) + 1 - 1)
      .startOf("day");
    this.updateDatesAndFetch();
  }
}
