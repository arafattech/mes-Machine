import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import ValueState from "@ui5/webcomponents-base/dist/types/ValueState.js";
import { Hall } from "@shared/model/hall";
import { ToastService } from "@app/services/toast-service/toast.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Permissions } from "@app/shared/enums/permissions";
import { Machine } from "@shared/model/machine";
import { MachineDashboardViewTypeClass } from "@shared/enums/machine-dashboard-view";
import { MachineState } from "@shared/model/machineState";
import { MachineGroup } from "@shared/model/machineGroup";
import { MachineWastageType } from "@shared/model/machineWastageType";
import { AssosiateComponent } from "@shared/components/assosiate/assosiate.component";
import { MachineGroupFormComponent } from "@base-data-module/machine-management/machine-group/machine-group-form/machine-group-form.component";
import { AgGridBooleanCellRendererComponent } from "@shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { AgGridRadioCellRendererComponent } from "@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@shared/components/ag-grid-table/types/ag-grid-table.types";

@Component({
  selector: "app-machine-form",
  templateUrl: "./machine-form.component.html",
  styleUrl: "./machine-form.component.scss",
})
export class MachineFormComponent implements OnInit {
  @ViewChild("hallAssociate") hallAssociateRef!: AssosiateComponent;
  @ViewChild("stateAssociate") stateAssociateRef!: AssosiateComponent;
  @ViewChild("wastageTypeAssociate") wastageTypeAssociateRef!: AssosiateComponent;
  @ViewChild("machineGroupForm") machineGroupFormRef!: MachineGroupFormComponent;

  @Input() saveMode = "POST";
  @Output() RefreshTable = new EventEmitter<void>();
  @Output() closeFrom = new EventEmitter<void>();
  @Output() isSuccessChange = new EventEmitter<void>();

  machine: Machine = new Machine().deserialize({});
  machineGroup = new MachineGroup();
  selectedTab = "coreData";
  readonly dashboardViewOptions = MachineDashboardViewTypeClass.getOptions();
  open = false;
  loading = false;
  ToastType: "add" | "edit" | "error" = "add";
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public localization = Localization;
  MachineGroup: MachineGroup[] | undefined;
  MachineState: MachineState[] = [];
  MachineHall: Hall[] = [];
  MachineWastageType: MachineWastageType[] = [];
  /** This machine's fallback state when no configured channel reads HIGH
   * (`machine_has_states.is_default`) — optional, `null` until explicitly picked. */
  defaultStateId: number | null = null;
  machineTitleGroup = "";
  SelectedGroup: MachineGroup = new MachineGroup().deserialize({});
  groupList = MachineGroup;
  stateList = MachineState;
  hallList = Hall;
  wastageTypeList = MachineWastageType;
  valueStateOptions = {
    name: ValueState.None,
    group: ValueState.None,
    oee: ValueState.None,
  };

  stateDataSource: AgGridTableODataSourceConfig<MachineState> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };

  hallDataSource: AgGridTableODataSourceConfig<Hall> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };

  wastageTypeDataSource: AgGridTableODataSourceConfig<MachineWastageType> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };

  stateToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Machine`} ${$localize`State`}`,
    showNewButton: true,
    addButtonText: $localize`Associate`,
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
  };

  hallToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Machine`} ${$localize`Hall`}`,
    showNewButton: true,
    addButtonText: $localize`Associate`,
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
  };

  wastageTypeToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Machine`} ${$localize`Wastage`}`,
    showNewButton: true,
    addButtonText: $localize`Associate`,
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
  };

  stateDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 347px)",
    rowHeight:30,
    fillEmptyRows: true,
  };

  hallDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 347px)",
    fillEmptyRows: true,
  };

  wastageTypeDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 347px)",
    fillEmptyRows: true,
  };

  stateColumns: AgGridTableColumn<MachineState>[] = [
    {
      field: "is_active",
      headerName: $localize`Active`,
      cellRenderer: AgGridBooleanCellRendererComponent,
      minWidth: 80,
      width: 90,
      filter: false,
      sortable: false,
    },
    {
      field: "is_default",
      headerName: $localize`Default`,
      cellRenderer: AgGridRadioCellRendererComponent,
      cellRendererParams: {
        onSelect: (row: MachineState) => this.onDefaultStateSelect(row),
      },
      minWidth: 90,
      width: 100,
      filter: false,
      sortable: false,
    },
    {
      field: "name",
      headerName: $localize`Name`,
      minWidth: 180,
      flex: 1,
    },
    {
      field: "created_at",
      headerName: this.localization.CreatedAt,
      minWidth: 130,
      width: 150,
      filter: false,
    },
  ];

  hallColumns: AgGridTableColumn<Hall>[] = [
    {
      field: "is_active",
      headerName: $localize`Active`,
      cellRenderer: AgGridBooleanCellRendererComponent,
      minWidth: 80,
      width: 90,
      filter: false,
      sortable: false,
    },
    {
      field: "custom_id",
      headerName: $localize`ID`,
      minWidth: 100,
      width: 130,
      filter: false,
    },
    {
      field: "name",
      headerName: $localize`Name`,
      minWidth: 180,
      flex: 1,
    },
    {
      field: "created_at",
      headerName: this.localization.CreatedAt,
      minWidth: 130,
      width: 150,
      filter: false,
    },
  ];

  wastageTypeColumns: AgGridTableColumn<MachineWastageType>[] = [
    {
      field: "is_active",
      headerName: $localize`Active`,
      cellRenderer: AgGridBooleanCellRendererComponent,
      minWidth: 80,
      width: 90,
      filter: false,
      sortable: false,
    },
    {
      field: "name",
      headerName: $localize`Name`,
      minWidth: 180,
      flex: 1,
    },
    {
      field: "created_at",
      headerName: this.localization.CreatedAt,
      minWidth: 130,
      width: 150,
      filter: false,
    },
  ];

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private rolePermissionService: RolePermissionService,
  ) {}

  /** Super-admin decides which roles may pick a machine's dashboard layout. */
  get canChangeDashboardView(): boolean {
    return this.rolePermissionService.hasPermission(Permissions.BASE_DATA_MACHINE_DASHBOARD_VIEW);
  }

  ngOnInit(): void {
    this.LoadMachineGroup();
  }

  checkValidation(event: any, field: string): void {
    const value = event.target?.value ?? "";
    switch (field) {
      case "name":
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.machine.machine_name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;
      case "group":
        if (!value.trim()) {
          this.valueStateOptions.group = ValueState.Negative;
          this.machineTitleGroup = "";
        } else {
          this.machineTitleGroup = value;
          this.valueStateOptions.group = ValueState.None;
        }
        break;
      case "oee":
        if (!value.trim()) {
          this.valueStateOptions.oee = ValueState.Negative;
        } else {
          this.machine.oee = value;
          this.valueStateOptions.oee = ValueState.None;
        }
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (this.machine.machine_name?.trim()) {
      this.valueStateOptions.name = ValueState.None;
    } else {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    if (this.machineTitleGroup.trim()) {
      this.valueStateOptions.group = ValueState.None;
    } else {
      this.valueStateOptions.group = ValueState.Negative;
      isValid = false;
    }
    // 0 is a valid OEE (every seeded machine has it) — only a missing/blank value is rejected.
    if (this.machine.oee != null && String(this.machine.oee).trim() !== "") {
      this.valueStateOptions.oee = ValueState.None;
    } else {
      this.valueStateOptions.oee = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  associateTableColum(): { accessor: string }[] {
    return [{ accessor: "custom_id" }, { accessor: "name" }];
  }

  setMachineState(states: MachineState[]): void {
    this.MachineState = states ?? [];
    this.updateStateGrid();

    // Pivot data (`is_default`) isn't exposed via the `Machines?$expand=states` OData path
    // this data came from (Lodata doesn't surface belongsToMany pivot columns through a
    // plain expand) — fetch it separately so the current default is pre-selected on edit.
    if (this.saveMode === saveMode.PUT && this.machine.id) {
      this.commonService
        .get<{ states: { id: number; is_default: boolean }[] }>(
          `machine/${this.machine.id}/states`,
          false,
        )
        .subscribe({
          next: (res) => {
            this.defaultStateId = res.states.find((s) => s.is_default)?.id ?? null;
            this.updateStateGrid();
          },
          error: () => {
            this.defaultStateId = null;
          },
        });
    }
  }

  onDefaultStateSelect(row: MachineState): void {
    this.defaultStateId = row.id ?? null;
    this.updateStateGrid();
  }

  setMachineHall(halls: Hall[]): void {
    this.MachineHall = halls ?? [];
    this.updateHallGrid();
  }

  setMachineWastageType(wastageTypes: MachineWastageType[]): void {
    this.MachineWastageType = wastageTypes ?? [];
    this.updateWastageTypeGrid();
  }

  private updateStateGrid(): void {
    // Fresh row objects (not just a fresh array) so the grid's row-identity diffing
    // actually re-renders the Default column when `defaultStateId` changes — a
    // `valueGetter` reading external component state doesn't reliably retrigger a
    // refresh when the underlying row objects themselves are unchanged.
    const rows = this.MachineState.map((s) =>
      new MachineState().deserialize({ ...s, is_default: s.id === this.defaultStateId }),
    );
    this.stateDataSource = { ...this.stateDataSource, data: rows };
  }

  private updateHallGrid(): void {
    this.hallDataSource = { ...this.hallDataSource, data: [...this.MachineHall] };
  }

  private updateWastageTypeGrid(): void {
    this.wastageTypeDataSource = { ...this.wastageTypeDataSource, data: [...this.MachineWastageType] };
  }

  isHallAssociate(): void {
    this.hallAssociateRef.open = true;
    this.hallAssociateRef.bindingData = this.MachineHall;
  }

  isStateAssociate(): void {
    this.stateAssociateRef.open = true;
    this.stateAssociateRef.bindingData = this.MachineState;
  }

  isWastageTypeAssociate(): void {
    this.wastageTypeAssociateRef.open = true;
    this.wastageTypeAssociateRef.bindingData = this.MachineWastageType;
  }

  GetSelectedState(items: MachineState[]): void {
    this.MachineState = items;
    this.updateStateGrid();
  }

  GetSelectedHall(items: Hall[]): void {
    this.MachineHall = items;
    this.updateHallGrid();
  }

  GetSelectedWastageType(items: MachineWastageType[]): void {
    this.MachineWastageType = items;
    this.updateWastageTypeGrid();
  }

  RemoveMachineState(item: MachineState): void {
    this.MachineState = this.MachineState.filter((s: MachineState) => s.id !== item.id);
    // A removed state can't stay the default — the backend 422s on a default_state_id
    // that isn't one of the submitted states.
    if (item.id === this.defaultStateId) {
      this.defaultStateId = null;
    }
    this.updateStateGrid();
  }

  RemoveMachineHall(item: Hall): void {
    this.MachineHall = this.MachineHall.filter((h: Hall) => h.id !== item.id);
    this.updateHallGrid();
  }

  RemoveMachineWastageType(item: MachineWastageType): void {
    this.MachineWastageType = this.MachineWastageType.filter((w: MachineWastageType) => w.id !== item.id);
    this.updateWastageTypeGrid();
  }

  LoadMachineGroup(): void {
    this.commonService
      .get("MachineGroups?$orderby=id desc&$filter=is_active eq true")
      .subscribe({
        next: (response: any) => {
          this.MachineGroup = response.value;
        },
        error: (_err: any) => {
          this.toastService.show("error");
        },
      });
  }

  getGroup(items: any): void {
    this.SelectedGroup = new MachineGroup().deserialize({
      id: items.detail.item.id,
      name: items.detail.item.text,
    });
    this.machineTitleGroup = this.SelectedGroup.name;
    this.checkValidation({ target: { value: this.SelectedGroup.name } }, "group");
  }

  AddMachine(): void {
    if (!this.validateForm()) {
      this.selectedTab = "coreData";
      return;
    }

    this.loading = true;
    let url = "";
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = "Machines";
      this.ToastType = "add";
      request$ = this.commonService.post(url, this.machine.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Machines(${this.machine.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, this.machine.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res: any) => {
          this.machine.deserialize(res);
          this.toastService.show(this.ToastType);
          if (this.MachineState.length > 0 || this.SelectedGroup.id || this.MachineHall.length > 0 || this.MachineWastageType.length > 0) {
            this.Associate(this.machine.id);
          } else {
            this.RefreshTable.emit();
            this.isSuccessChange.emit();
            this.CloseDialog();
          }
        },
        error: (_error: any) => {
          this.CloseDialog();
          this.toastService.show("error");
        },
      });
    }
  }

  Associate(id: number | undefined): void {
    const data = {
      machine_id: id,
      machinestate: this.MachineState,
      machinehall: this.MachineHall,
      machinegroup: Array.isArray(this.SelectedGroup)
        ? this.SelectedGroup
        : [this.SelectedGroup],
      default_state_id: this.defaultStateId,
      machinewastagetype: this.MachineWastageType,
    };
    this.commonService.post("machine/associate", data, false).subscribe({
      next: (_response: any) => {
        this.RefreshTable.emit();
        this.isSuccessChange.emit();
        this.CloseDialog();
      },
      error: (_err: any) => {
        this.toastService.show("error");
        this.CloseDialog();
      },
    });
  }

  onTabSelect(event: any): void {
    this.selectedTab = event.detail.tab.id;
  }

  onDashboardViewChange(event: Event): void {
    const option = (event as CustomEvent<{ selectedOption: HTMLElement }>).detail.selectedOption;
    this.machine.dashboard_view = MachineDashboardViewTypeClass.resolve(option.getAttribute("value"));
  }

  OnAddClickMachineGroup(): void {
    this.machineGroupFormRef.open = true;
  }

  autoGroupAdded(newGroup: MachineGroup): void {
    this.MachineGroup = [newGroup, ...(this.MachineGroup ?? [])];
    this.SelectedGroup = new MachineGroup().deserialize({
      id: newGroup.id,
      name: newGroup.name,
    });
    this.machine.machinegroups = [this.SelectedGroup];
    this.machineTitleGroup = newGroup?.name ?? "";
  }

  resetForm(): void {
    this.selectedTab = "coreData";
    this.machine = new Machine().deserialize({});
    this.valueStateOptions = {
      name: ValueState.None,
      group: ValueState.None,
      oee: ValueState.None,
    };
    this.MachineState = [];
    this.MachineHall = [];
    this.MachineWastageType = [];
    this.defaultStateId = null;
    this.SelectedGroup = new MachineGroup().deserialize({});
    this.machineTitleGroup = "";
    this.stateAssociateRef.bindingData = [];
    this.hallAssociateRef.bindingData = [];
    this.wastageTypeAssociateRef.bindingData = [];
    this.updateStateGrid();
    this.updateHallGrid();
    this.updateWastageTypeGrid();
  }

  resetValuState(): void {
    this.valueStateOptions = {
      name: ValueState.None,
      group: ValueState.None,
      oee: ValueState.None,
    };
  }

  CloseDialog(): void {
    this.open = false;
    this.loading = false;
    this.resetForm();
    this.closeFrom.emit();
  }
}
