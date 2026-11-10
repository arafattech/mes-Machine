import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import ValueState from "@ui5/webcomponents-base/dist/types/ValueState.js";
import { Hall } from "@shared/model/hall";
import { Plant } from "@shared/model/plant";
import { ToastService } from "@app/services/toast-service/toast.service";
import { AssosiateComponent } from "@app/shared/components/assosiate/assosiate.component";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridBooleanCellRendererComponent } from "@shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@shared/components/ag-grid-table/types/ag-grid-table.types";

@Component({
  selector: "app-hall-form",
  templateUrl: "./hall-form.component.html",
  styleUrl: "./hall-form.component.scss",
})
export class HallFormComponent implements OnInit {
  @Input() saveMode = "POST";
  @ViewChild("plantAssociate") hallAssociateRef!: AssosiateComponent;
  @Output() RefreshTable = new EventEmitter<void>();

  @Input() hall: Hall = new Hall().deserialize({});

  selectedTab = "coreData";
  open = false;
  loading = false;
  ToastType: "add" | "edit" | "error" = "add";
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public localization = Localization;
  public permissions = Permissions;
  plantList = Plant;
  plants: Plant[] = [];
  valueStateOptions = { name: ValueState.None };

  plantDataSource: AgGridTableODataSourceConfig<Plant> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };

  plantToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Plant`} ${$localize`List`}`,
    showNewButton: true,
    addButtonText: $localize`Associate`,
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
  };

  plantDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(45vh - 135px)",
    fillEmptyRows: true,
  };

  plantColumns: AgGridTableColumn<Plant>[] = [
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

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    public rolePermissionService: RolePermissionService
  ) {}

  ngOnInit(): void {}

  checkValidation(event: any): void {
    const value = event.target.value;
    if (!value.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
    } else {
      this.valueStateOptions.name = ValueState.None;
    }
  }

  validateForm(): boolean {
    if (!this.hall.name) {
      this.valueStateOptions.name = ValueState.Negative;
      return false;
    }
    return true;
  }

  associatePlantTableColum(): { accessor: string }[] {
    return [{ accessor: "custom_id" }, { accessor: "name" }];
  }

  setPlants(plants: Plant[]): void {
    this.plants = plants ?? [];
    this.updatePlantGrid();
  }

  private updatePlantGrid(): void {
    this.plantDataSource = { ...this.plantDataSource, data: [...this.plants] };
  }

  isHallAssociate(): void {
    this.hallAssociateRef.open = true;
    this.hallAssociateRef.bindingData = this.plants;
  }

  GetSelectedHall(items: Plant[]): void {
    this.plants = items;
    this.updatePlantGrid();
  }

  removePlantData(item: Plant): void {
    this.plants = this.plants.filter((p: Plant) => p.id !== item.id);
    this.updatePlantGrid();
  }

  newHall(): void {
    if (!this.validateForm()) {
      this.selectedTab = "coreData";
      return;
    }

    this.loading = true;
    let url = "";
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = "Halls";
      this.ToastType = "add";
      request$ = this.commonService.post(url, this.hall.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Halls(${this.hall.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, this.hall.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res: any) => {
          const id = this.saveMode === saveMode.POST ? res?.id : this.hall.id;
          this.toastService.show(this.ToastType);
          this.associate(id);
        },
        error: (_error: any) => {
          this.CloseDialog();
          this.toastService.show("error");
        },
      });
    }
  }

  associate(id: number | undefined): void {
    const data = { hall_id: id, plants: this.plants };
    this.commonService.post("hall/associate", data, false).subscribe({
      next: (_response: any) => {
        this.RefreshTable.emit();
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

  resetForm(): void {
    this.selectedTab = "coreData";
    this.hall = new Hall().deserialize({});
    this.valueStateOptions.name = ValueState.None;
    this.hallAssociateRef.bindingData = [];
    this.plants = [];
    this.updatePlantGrid();
  }

  CloseDialog(): void {
    this.open = false;
    this.loading = false;
    this.resetForm();
  }
}
