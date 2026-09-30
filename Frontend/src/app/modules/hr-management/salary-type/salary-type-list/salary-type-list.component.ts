import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  inject,
  Output,
  ViewChild,
} from "@angular/core";
import { saveMode } from "@shared/enums/saveMode";
import { SalaryType } from "@app/modules/hr-management/shared/models/SalaryType";
import { SharedModule } from "@app/shared/shared.module";
import { DeleteEntityComponent } from "@app/shared/components/delete-entity/delete-entity.component";
import { SalaryTypeFormComponent } from "../salary-type-form/salary-type-form.component";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";

@Component({
  selector: "app-salary-type-list",
  imports: [SharedModule, DeleteEntityComponent, SalaryTypeFormComponent],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./salary-type-list.component.html",
  styleUrl: "./salary-type-list.component.scss",
})
export class SalaryTypeListComponent {
  private dateFormatter = inject(DateFormatterService);

  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<SalaryType>;
  @ViewChild("salaryTypeForm") salaryTypeFormRef!: SalaryTypeFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();

  salaryType = new SalaryType().deserialize({});
  public saveMode: string = saveMode.POST;

  columns: AgGridTableColumn<SalaryType>[] = [
    {
      field: "is_active",
      headerName: $localize`Active`,
      minWidth: 80,
      width: 90,
      cellRenderer: AgGridBooleanCellRendererComponent,
      filter: false,
      sortable: false,
      floatingFilter: false,
    },
    {
      field: "custom_id",
      headerName: $localize`ID`,
      minWidth: 120,
      width: 130,
    },
    {
      field: "name",
      headerName: $localize`Name`,
      flex: 1,
      minWidth: 150,
    },
    {
      field: "type",
      headerName: $localize`Type`,
      minWidth: 130,
    },
    {
      field: "created_at",
      headerName: $localize`Created On`,
      minWidth: 130,
      filter: false,
      floatingFilter: false,
      dataType: GridTableColumnDataType.Date,
      valueFormatter: ({ value }: any) =>
        value
          ? this.dateFormatter.formatDate(value, true, false, false, false, false)
          : "",
    },
  ];

  dataSource: AgGridTableODataSourceConfig<SalaryType> = {
    type: "odata",
    endpoint: "SalaryTypes",
    pageSize: 50,
    searchFields: ["custom_id", "name", "type"],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Salary Types`,
    addButtonText: $localize`New`,
    showSearch: true,
    showRowCount: true,
    showNewButton: true,
    showDownload: false,
  };

  processData(event?: any) {
    this.refreshTable.emit(event);
    this.agGridRef?.refreshGridData(true);
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`SalaryTypes/${id}`);
  }

  newSalaryType() {
    this.salaryType = new SalaryType().deserialize({});
    this.salaryTypeFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editSalaryType(data: any) {
    this.salaryType = new SalaryType().deserialize(data);
    this.salaryTypeFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }
}
