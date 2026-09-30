import { Component, EventEmitter, Output, ViewChild } from "@angular/core";
import { Hall } from "@app/shared/model/hall";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { HallFormComponent } from "@app/modules/base-data-management/hall-management/hall-form/hall-form.component";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@app/shared/utilities/localization";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";

@Component({
  selector: "app-hall-list",
  templateUrl: "./hall-list.component.html",
  styleUrl: "./hall-list.component.scss",
})
export class HallListComponent {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<Hall>;
  @ViewChild("hallForm") hallFormRef!: HallFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  public localization = Localization;
  public permissions = Permissions;

  insertTitle: string = $localize`New`;
  headerTitle: string = `${$localize`Hall`} ${$localize`List`}`;

  dataSource: AgGridTableODataSourceConfig<Hall> = {
    type: "odata",
    endpoint: "Halls",
    expand: "plants",
    sortBy: "id",
    sortDirection: "desc",
    searchFields: ["name", "custom_id"],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_HALL_CREATE,
    ),
    addButtonText: this.insertTitle,
  };

  columns: AgGridTableColumn<Hall>[] = [];

  constructor(public rolePermissionService: RolePermissionService) {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<Hall>[] {
    return [
      {
        field: "is_active",
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: "custom_id",
        headerName: $localize`ID`,
        minWidth: 100,
        filter: false,
      },
      {
        field: "name",
        headerName: `${$localize`Hall`} ${$localize`Name`}`,
        minWidth: 180,
      },
      {
        field: "created_at",
        headerName: this.localization.CreatedAt,
        minWidth: 130,
        filter: false,
      },
    ];
  }

  onDeleteHall(row: Hall): void {
    this.IsDelete.emit(`Halls(${row.id})`);
  }

  processData(_event?: any): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
  }

  newHall(): void {
    this.hallFormRef.resetForm();
    this.hallFormRef.hall = new Hall().deserialize({});
    this.hallFormRef.plants = [];
    this.hallFormRef.saveMode = saveMode.POST;
    this.hallFormRef.open = true;
  }

  editHall(data: any): void {
    this.hallFormRef.resetForm();
    this.hallFormRef.hall = new Hall().deserialize(data);
    this.hallFormRef.setPlants(data.plants ?? []);
    this.hallFormRef.saveMode = saveMode.PUT;
    this.hallFormRef.open = true;
  }
}
