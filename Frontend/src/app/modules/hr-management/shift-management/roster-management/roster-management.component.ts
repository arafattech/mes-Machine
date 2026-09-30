import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import moment from "moment";
import {
  CdkDragDrop,
  CdkDragEnd,
  CdkDragMove,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import { CommonService } from "@app/services/common-service/common.service";
import { ShiftPlanningComponent } from "@app/modules/hr-management/shift-management/shift-planning/shift-planning.component";
import { SHIFTVIEWTYPE } from "@app/shared/enums/shiftViewType";
import { ShiftType } from "@app/modules/hr-management/shared/enums/shiftType";
import { RosterViewType } from "@app/modules/hr-management/shared/enums/rosterViewType";
import { OffDayType } from "@app/modules/hr-management/shared/enums/offDayType";
import { Month } from "@app/modules/hr-management/shared/enums/month";
import { Localization } from "@shared/utilities/localization";
import { ToastService } from "@app/services/toast-service/toast.service";
import { saveMode } from "@app/shared/enums/saveMode";
import { ThemeService } from "@app/services/theme.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Permissions } from "@app/shared/enums/permissions";
import { SocketService } from "@app/services/socket.service";
@Component({
  selector: "app-roster-management",
  templateUrl: "./roster-management.component.html",
  styleUrl: "./roster-management.component.scss",
})
export class RosterManagementComponent implements OnInit {
  @ViewChild("shiftPlanningDialog")
  shiftPlanningDialog!: ShiftPlanningComponent;
  @ViewChild("monthSelect") monthSelectref: any;
  @ViewChild("selectViewType") selectViewTyperef: any;
  @ViewChild("shiftViewType") shiftViewTyperef: any;
  localization = Localization;
  ShiftType = ShiftType;
  Month = Month;
  titleText: string = `${$localize`No Shift Available`}`;
  RosterViewType = RosterViewType;
  OffDayType = OffDayType;
  public weekDates: any[] = [];
  public ViewType: "day" | "week" | "month" = "day";
  moment = moment();
  public currentWeekStart: moment.Moment = moment().startOf("day");
  public showrosterforDays: number = 1;
  public isLoading: boolean = false;
  public rostersLists: any[] = [];
  public start_date: string = "";
  public end_date: string = "";
  public shiftviewtypes = Object.values(SHIFTVIEWTYPE);
  public employeeviewtypes = Object.values(RosterViewType);
  public months = Object.values(Month);
  selectedMonth: any = new Date().getMonth();
  public selectedEmployeeView: RosterViewType = RosterViewType.ALL;
  public selectedEmployees: any[] = [];
  public showActionPopover = false;
  public showExportConfirm = false;
  public actionPopoverTargetShiftId: number | null = null;
  public currentActionDate: string | null = null;
  public pendingDraggedData: any | null = null;
  public selectedOverridesType: string = "";
  public selectedTargetEmployeeId: null = null;
  public permissions = Permissions;
  employeeSearchText: { [shiftId: string]: string } = {};
  allEmployeesValue = true ? 1 : 0;
  isSwapContinerEmployeeMatch: boolean = false;
  previousContainerData: any[] = [];
  private pendingDropEvent: CdkDragDrop<any[]> | null = null;
  private autoScrollFrameId: number | null = null;
  private autoScrollContainer: HTMLElement | null = null;
  private autoScrollStep: number = 0;
  private readonly autoScrollEdgeThreshold = 96;
  private readonly autoScrollMaxStep = 18;
  targetRosterId: null = null
  isSearchVisible: { [key: string]: boolean } = {};

  constructor(
    private http: CommonService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    public theme: ThemeService,
    public permission: RolePermissionService,
    private socketService: SocketService,
  ) { }

  ngOnInit() {
    const now = new Date();
    this.selectedMonth = this.months[now.getMonth()];
    this.ViewType = "day";
    this.showrosterforDays = 1;
    this.currentWeekStart = moment().startOf("day");
    this.updateDatesAndFetch();
  }

  onMonthChange(month: any) {
    this.currentWeekStart = this.moment
      .month(Number(month.detail.item.value) + 1 - 1)
      .startOf("day");
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
    this.end_date = this.weekDates[this.weekDates.length - 1].fullDate.format("YYYY-MM-DD");
    let month = new Date(this.end_date).getMonth();
    this.selectedMonth = this.months[month];
    this.initRosters();
  }

  onExportRoster() {
    if (
      this.selectedEmployeeView === RosterViewType.INDIVIDUAL &&
      this.selectedEmployees.length === 0
    ) {
      this.toast.show("error");
      return;
    }

    this.showExportConfirm = true;
  }

  closeExportConfirm(): void {
    this.showExportConfirm = false;
  }

  confirmExportRoster(): void {
    this.showExportConfirm = false;

    if (
      this.selectedEmployeeView === RosterViewType.INDIVIDUAL &&
      this.selectedEmployees.length === 0
    ) {
      this.toast.show("error");
      return;
    }

    const payload: any = {
      start_date: this.start_date,
      end_date: this.end_date,
      all_employees: this.selectedEmployeeView === RosterViewType.ALL,
    };

    if (this.selectedEmployeeView === RosterViewType.INDIVIDUAL) {
      payload.employee_ids = this.selectedEmployees.map((employee) => employee.id);
    }

    const scope = this.selectedEmployeeView === RosterViewType.INDIVIDUAL ? "individual" : "all";
    const rangeLabel = this.showrosterforDays === 1 ? "day" : "week";
    const filename =
      this.start_date === this.end_date
        ? `roster_${scope}_${rangeLabel}_${this.start_date}.xlsx`
        : `roster_${scope}_${rangeLabel}_${this.start_date}_to_${this.end_date}.xlsx`;

    this.http
      .post<Blob>("hrm/roster-schedule/export", payload, false, undefined, "blob")
      .subscribe({
        next: (res: Blob) => {
          const url = window.URL.createObjectURL(res);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.toast.show("download");
        },
        error: (err) => {
          console.error("Error downloading roster export:", err);
          this.toast.show("error");
        },
      });
  }

  private hasOverride(employee: any): boolean {
    return (
      employee?.override_info != null ||
      [ShiftType.SWAP, ShiftType.REPLACEMENT, ShiftType.EXTRA].includes(
        employee?.status
      )
    );
  }

  private compareEmployeeNo(a: any, b: any): number {
    const currentEmployeeNo = String(a?.employee_details?.employee_no ?? "").trim();
    const nextEmployeeNo = String(b?.employee_details?.employee_no ?? "").trim();

    if (currentEmployeeNo && nextEmployeeNo) {
      return currentEmployeeNo.localeCompare(nextEmployeeNo, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }

    if (currentEmployeeNo) return -1;
    if (nextEmployeeNo) return 1;

    return (a?.employee_details?.name || "").localeCompare(
      b?.employee_details?.name || ""
    );
  }

  private sortShiftEmployees(employees: any[] = []): any[] {
    return [...employees].sort((currentEmployee: any, nextEmployee: any) => {
      const currentEmployeePriority = this.hasOverride(currentEmployee) ? 0 : 1;
      const nextEmployeePriority = this.hasOverride(nextEmployee) ? 0 : 1;

      if (currentEmployeePriority !== nextEmployeePriority) {
        return currentEmployeePriority - nextEmployeePriority;
      }

      return this.compareEmployeeNo(currentEmployee, nextEmployee);
    });
  }

  private sortRosterEmployees(rosterDays: any[] = []): any[] {
    return rosterDays.map((day: any) => ({
      ...day,
      shifts: (day.shifts || []).map((shift: any) => ({
        ...shift,
        employees: this.sortShiftEmployees(shift.employees || []),
      })),
    }));
  }

  private calculateAutoScrollStep(distanceFromEdge: number): number {
    const normalizedDistance = Math.max(0, distanceFromEdge);
    const scrollRatio =
      (this.autoScrollEdgeThreshold - normalizedDistance) /
      this.autoScrollEdgeThreshold;

    return Math.max(4, Math.ceil(scrollRatio * this.autoScrollMaxStep));
  }

  private runAutoScroll = (): void => {
    if (!this.autoScrollContainer || this.autoScrollStep === 0) {
      this.stopAutoScroll();
      return;
    }

    const scrollContainer = this.autoScrollContainer;
    scrollContainer.scrollLeft += this.autoScrollStep;

    const reachedLeftEdge =
      this.autoScrollStep < 0 && scrollContainer.scrollLeft <= 0;
    const reachedRightEdge =
      this.autoScrollStep > 0 &&
      scrollContainer.scrollLeft + scrollContainer.clientWidth >=
      scrollContainer.scrollWidth;

    if (reachedLeftEdge || reachedRightEdge) {
      this.stopAutoScroll();
      return;
    }

    this.autoScrollFrameId = window.requestAnimationFrame(this.runAutoScroll);
  };

  private startAutoScroll(scrollContainer: HTMLElement, scrollStep: number): void {
    this.autoScrollContainer = scrollContainer;
    this.autoScrollStep = scrollStep;

    if (this.autoScrollFrameId !== null) {
      return;
    }

    this.autoScrollFrameId = window.requestAnimationFrame(this.runAutoScroll);
  }

  private stopAutoScroll(): void {
    if (this.autoScrollFrameId !== null) {
      window.cancelAnimationFrame(this.autoScrollFrameId);
    }

    this.autoScrollFrameId = null;
    this.autoScrollContainer = null;
    this.autoScrollStep = 0;
  }

  onEmployeeDragMoved(
    event: CdkDragMove<any>,
    primaryScrollContainer: HTMLElement,
    fallbackScrollContainer?: HTMLElement
  ): void {
    const scrollContainer =
      primaryScrollContainer &&
        primaryScrollContainer.scrollWidth > primaryScrollContainer.clientWidth
        ? primaryScrollContainer
        : fallbackScrollContainer;

    if (!scrollContainer || scrollContainer.scrollWidth <= scrollContainer.clientWidth) {
      this.stopAutoScroll();
      return;
    }

    const { left, right } = scrollContainer.getBoundingClientRect();
    const pointerX = event.pointerPosition.x;
    const leftDistance = pointerX - left;
    const rightDistance = right - pointerX;
    const canScrollLeft = scrollContainer.scrollLeft > 0;
    const canScrollRight =
      scrollContainer.scrollLeft + scrollContainer.clientWidth <
      scrollContainer.scrollWidth;

    if (leftDistance <= this.autoScrollEdgeThreshold && canScrollLeft) {
      this.startAutoScroll(
        scrollContainer,
        -this.calculateAutoScrollStep(leftDistance)
      );
      return;
    }

    if (rightDistance <= this.autoScrollEdgeThreshold && canScrollRight) {
      this.startAutoScroll(
        scrollContainer,
        this.calculateAutoScrollStep(rightDistance)
      );
      return;
    }

    this.stopAutoScroll();
  }

  onEmployeeDragEnded(_: CdkDragEnd<any>): void {
    this.stopAutoScroll();
  }

  getFilteredEmployees(shift: any) {
    const search = this.employeeSearchText[shift.shift_id]?.toLowerCase() || "";
    if (!search) return shift.employees;
    return shift.employees.filter((emp: any) => {
      const name = emp.employee_details?.name?.toLowerCase() || "";
      const empNo = String(emp.employee_details?.employee_no ?? "").toLowerCase();
      return name.includes(search) || empNo.includes(search);
    });
  }

  onresetRoster() {
    const now = new Date();
    this.selectedMonth = this.months[now.getMonth()];
    if (this.monthSelectref) {
      this.monthSelectref.elementRef.nativeElement.value = this.selectedMonth;
    }

    if (this.selectViewTyperef.elementRef.nativeElement) {
      this.selectedEmployeeView = RosterViewType.ALL;
      this.selectViewTyperef.elementRef.nativeElement.value =
        RosterViewType.ALL;
    }

    if (this.shiftViewTyperef.elementRef.nativeElement) {
      this.shiftViewTyperef.elementRef.nativeElement.value =
        this.shiftviewtypes[0];
    }

    this.cdr.detectChanges();
    this.ngOnInit();
  }

  toggleSearch(shiftId: string) {
    this.isSearchVisible[shiftId] = !this.isSearchVisible[shiftId];
  }

  onEmployeeViewChange(event: any) {
    this.selectedEmployeeView = event.detail.item.text;

    if (this.selectedEmployeeView === RosterViewType.ALL) {
      this.selectedEmployees = [];
      this.initRosters();
    }
  }

  employeeLabelFn = (item: any) =>
    `${item.employee_no} - ${item.first_name} ${item.last_name || ''}`.trim();

  onEmployeeMultiSelectChange(selectedEmployees: any[]) {
    this.selectedEmployees = selectedEmployees ?? [];

    if (
      this.selectedEmployeeView === RosterViewType.INDIVIDUAL &&
      this.selectedEmployees.length > 0
    ) {
      this.getRosterForSelectedEmployees();
    } else {
      this.rostersLists = [];
    }
  }


  formatShiftGroups(shift: any): string {
    return (shift.groups ?? []).map((group: any) => group.name).join(', ');
  }

  checkIfHasRoster(roster: any): boolean {
    let hasRoster = false;
    if (roster?.shifts && roster.shifts.length > 0) {
      hasRoster = roster.shifts.some((shift: any) => shift.roster_id !== null);
    }
    return hasRoster;
  }

  initRosters() {
    if (
      this.selectedEmployeeView === RosterViewType.INDIVIDUAL &&
      this.selectedEmployees.length > 0
    ) {
      this.getRosterForSelectedEmployees();
      return;
    }
    this.isLoading = true;
    this.http
      .get(
        `hrm/roster-schedule?start_date=${this.start_date}&end_date=${this.end_date}&all_employees=1`,
        false
      )
      .subscribe({
        next: (res: any) => {
          this.rostersLists = this.sortRosterEmployees(res.data || []);
          this.isLoading = false;
        },
        error: (err) => {
          console.error("Error fetching rosters:", err);
          this.isLoading = false;
        },
      });
  }


  private emitRosterReload(): void {
    this.socketService.emit("biometrics_roster_reload");
  }

  getRosterForSelectedEmployees() {
    if (!this.selectedEmployees.length) return;

    this.isLoading = true;
    const employeeIds = this.selectedEmployees
      .map((employee) => `employee_ids[]=${employee.id}`)
      .join("&");
    this.http
      .get(
        `hrm/roster-schedule?start_date=${this.start_date}&end_date=${this.end_date}&all_employees=0&${employeeIds}`,
        false
      )
      .subscribe({
        next: (res: any) => {
          this.rostersLists = this.sortRosterEmployees(res.data || []);
          this.isLoading = false;
        },
        error: (err) => {
          console.error("Error fetching selected employee rosters:", err);
          this.isLoading = false;
        },
      });
  }

  countOverrides(shift: any, type: string): number {
    let count = 0;

    if (type === ShiftType.SWAP) {
      count = shift.employees.filter((emp: any) => emp.status === ShiftType.SWAP).length;
    } else if (type === 'Weekend') {
      count = shift.employees.filter((emp: any) => emp.employee_details.holiday_status === "Weekend").length;
    } else if (type === ShiftType.EXTRA) {
      count = shift.employees.filter((emp: any) => emp.status === ShiftType.EXTRA).length;
    } else if (type === ShiftType.REPLACEMENT) {
      count = shift.employees.filter((emp: any) => emp.status === ShiftType.REPLACEMENT).length;
    }

    return count;
  }

  onEmployeeSearch(event: any, shiftId: string) {
    this.employeeSearchText[shiftId] = event.target.value.toLowerCase();
  }

  onViewTypeChange(event: any) {
    const viewtype = event.detail.item.text.toUpperCase();
    this.ViewType = event.detail.item.text.toLowerCase();

    if (viewtype === SHIFTVIEWTYPE.DAY) {
      this.showrosterforDays = 1;
    } else if (viewtype === SHIFTVIEWTYPE.WEEK) {
      this.showrosterforDays = 7;
    }

    this.updateDatesAndFetch();
  }

  previousWeek() {
    this.currentWeekStart.subtract(this.showrosterforDays, "days");
    this.updateDatesAndFetch();
  }

  nextWeek() {
    this.currentWeekStart.add(this.showrosterforDays, "days");
    this.updateDatesAndFetch();
  }

  selectDay(day: any) {
    if (this.ViewType === "day") {
      this.currentWeekStart = day.fullDate.clone();
      this.updateDatesAndFetch();
    }
  }

  onNewShiftPlanning() {
    this.shiftPlanningDialog.rosterCreateType = "MULTIPLE";
    this.shiftPlanningDialog.isShiftPlanningOpen = true;
  }

  editRoster(rosterData: any) {
    this.shiftPlanningDialog.saveMode = saveMode.PUT;
    this.shiftPlanningDialog.rosterCreateType = "SINGLE";
    let stdate = moment(rosterData.day).format("YYYY/MM/DD");
    let enddate = moment(rosterData.day).format("YYYY/MM/DD");
    this.shiftPlanningDialog.dateRangeValue = `${stdate} - ${enddate}`;
    this.shiftPlanningDialog.startDate = stdate;
    this.shiftPlanningDialog.endDate = enddate;

    rosterData.shifts.forEach((shift: any) => {
      this.shiftPlanningDialog.applyShiftGroups(
        shift.shift_id,
        shift.groups ?? [],
        shift.roster_id
      );
    });
    this.shiftPlanningDialog.isShiftPlanningOpen = true;
  }

  onNewSingleRoster(date: any) {
    this.shiftPlanningDialog.saveMode = saveMode.POST;
    this.shiftPlanningDialog.rosterCreateType = "SINGLE";
    let stdate = moment(date).format("YYYY/MM/DD");
    let enddate = moment(date).format("YYYY/MM/DD");
    this.shiftPlanningDialog.dateRangeValue = `${stdate} - ${enddate}`;
    this.shiftPlanningDialog.startDate = stdate;
    this.shiftPlanningDialog.endDate = enddate;
    this.shiftPlanningDialog.isShiftPlanningOpen = true;
  }

  findShiftById(shiftId: number) {
    for (const day of this.rostersLists) {
      const found = day.shifts.find(
        (shiftdata: any) => shiftdata.shift_id === shiftId
      );
      if (found) return found;
    }
    return null;
  }

  isSwapContainerMatch(id: any) {
    this.isSwapContinerEmployeeMatch = Object.values(this.previousContainerData)
      .some((item: any) => item.employee_details.id == id);
  }

  onShiftDrop(event: CdkDragDrop<any[]>, date: string, rosterId: null) {
    this.stopAutoScroll();

    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      return;
    }
    if (rosterId) {
      this.targetRosterId = rosterId;
    }

    const draggedData = event.item.data;
    this.previousContainerData = event.previousContainer.data;
    const targetShiftId = Number(event.container.id);
    const targetContainer = event.container.data;


    const targetEmployeeIds = new Set(
      targetContainer.map((emp) => emp.employee_details.id)
    );

    const isAlreadyInTarget = targetEmployeeIds.has(
      draggedData.employee.employee_details.id
    );

    if (!isAlreadyInTarget) {
      this.pendingDropEvent = event;
      this.pendingDraggedData = draggedData;
      this.actionPopoverTargetShiftId = targetShiftId;
      this.currentActionDate = date;
      this.showActionPopover = true;
    } else {
      this.toast.show("exist");
      this.resetActionState();
    }
  }

  private persistShiftOverride(payload: any, overrideId: number | null): void {
    const createOverride = () => {
      this.onSaveOverrides(payload);
      this.resetActionState();
    };

    if (!overrideId) {
      createOverride();
      return;
    }

    this.isLoading = true;
    this.http.delete(`ShiftOverrides(${overrideId})`, true).subscribe({
      next: () => createOverride(),
      error: (err: any) => {
        console.error("Error removing previous override:", err);
        this.toast.show("error");
        this.resetActionState();
      },
    });
  }

  resetActionState(): void {
    this.stopAutoScroll();
    this.showActionPopover = false;
    this.actionPopoverTargetShiftId = null;
    this.pendingDraggedData = null;
    this.pendingDropEvent = null;
    this.selectedTargetEmployeeId = null;
    this.isSwapContinerEmployeeMatch = false;
    this.previousContainerData = [];
    this.targetRosterId = null;
    this.currentActionDate = null;
  }

  onTargetEmployeeToOverrides(event: any) {
    let id = event.detail.item.id;
    this.selectedTargetEmployeeId = id;
    this.isSwapContainerMatch(this.selectedTargetEmployeeId);
  }

  filteredEmployees(employees: any[]): any[] {
    return employees.filter(emp => emp.employee_details.holiday_status !== "Weekend");
  }

  executeShiftAction(action: "extra" | "replace" | "swap", date: string): void {
    if (!this.pendingDraggedData || !this.actionPopoverTargetShiftId) {
      this.resetActionState();
      return;
    }

    const draggedEmployee = this.pendingDraggedData.employee.employee_details;
    const existingOverrideId = this.pendingDraggedData.employee?.override_info?.id ?? null;
    const sourceShift = this.findShiftById(
      this.pendingDraggedData.sourceShiftId
    );
    const targetShift = this.findShiftById(this.actionPopoverTargetShiftId);

    if (!sourceShift || !targetShift) {
      this.resetActionState();
      return;
    }

    if (action === "swap" && !this.selectedTargetEmployeeId) return;

    const sourceIndex = sourceShift.employees.findIndex(
      (e: any) => e.employee_details.id === draggedEmployee.id
    );
    if (sourceIndex > -1) sourceShift.employees.splice(sourceIndex, 1);

    let targetEmployee: any | undefined;
    if (this.selectedTargetEmployeeId)
      targetEmployee = targetShift.employees.find(
        (e: any) => e.employee_details.id === this.selectedTargetEmployeeId
      );

    switch (action) {
      case "extra":
        this.selectedOverridesType = ShiftType.EXTRA;
        targetShift.employees.push({
          employee_details: draggedEmployee,
          status: "EXTRA",
          override_info: null,
        });
        break;

      case "replace":
        this.selectedOverridesType = ShiftType.REPLACEMENT;

        targetShift.employees.push({
          employee_details: draggedEmployee,
          status: "REPLACEMENT",
          override_info: null,
        });
        break;

      case "swap":
        if (!this.selectedTargetEmployeeId) break;
        this.selectedOverridesType = ShiftType.SWAP;

        if (targetEmployee) {
          const targetIndex = targetShift.employees.findIndex(
            (e: any) => e.employee_details.id === targetEmployee.employee_details.id
          );
          if (targetIndex > -1) {
            targetShift.employees.splice(targetIndex, 1);
          }

          sourceShift.employees.push({
            employee_details: targetEmployee.employee_details,
            status: "SWAP",
            override_info: null,
          });
        }

        targetShift.employees.push({
          employee_details: draggedEmployee,
          status: "SWAP",
          override_info: null,
        });

        break;
    }

    sourceShift.employees = this.sortShiftEmployees(sourceShift.employees);
    targetShift.employees = this.sortShiftEmployees(targetShift.employees);

    const payload = {
      roster_id: this.targetRosterId,
      shift_id: targetShift.shift_id,
      type: this.selectedOverridesType,
      second_shift_id: this.pendingDraggedData.sourceShiftId,
      replacement_employee_id: draggedEmployee.id,
      absent_employee_id:
        action == "extra" || action == "replace" ? null : this.selectedTargetEmployeeId,
      date: date,
    };

    if (payload.roster_id == null) {
      this.isLoading = true;
      this.http
        .post(
          "Rosters",
          {
            start_date: payload.date,
            end_date: payload.date,
            shift_id: payload.shift_id,
          },
          true
        )
        .subscribe({
          next: (res: any) => {
            payload.roster_id = res.id;
            this.persistShiftOverride(payload, existingOverrideId);
          },
          error: (err) => console.error(err),
        });
    } else {
      this.persistShiftOverride(payload, existingOverrideId);
    }
  }

  onSaveOverrides(data: object) {
    this.isLoading = true;
    this.http.post("hrm/shift-overrides", data, false).subscribe({
      next: (res: any) => {
        this.toast.show("add");
        this.emitRosterReload();
        this.initRosters();
      },
      error: (err) => console.error(err),
    });
  }

  profilebgChange(first_letter: string, last_letter: string): { [key: string]: string } {
    const letters = (first_letter + last_letter).toUpperCase();
    let hash = 0;
    for (let i = 0; i < letters.length; i++) {
      hash += letters.charCodeAt(i);
    }

    const index = (hash % 10) + 1;
    return {
      "background-color": `var(--sapAccentBackgroundColor${index})`,
      color: `var(--sapAccentColor${index})`,
    };
  }

  onRemoveOverrides(data: any) {
    this.isLoading = true;
    this.http.delete(`ShiftOverrides(${data.id})`, true).subscribe({
      next: (res: any) => {
        this.toast.show("remove");
        this.emitRosterReload();
        this.initRosters();
      },
      error: (err: any) => {
        this.toast.show("error");
      },
    });
  }
}
