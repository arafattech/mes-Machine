import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { Localization } from "@shared/utilities/localization";
import { Asset } from "@shared/model/asset";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { EmployeeHasAsset } from "@app/modules/hr-management/shared/models/employeeHasAsset";
@Component({
  selector: "app-asset-section",
  templateUrl: "./asset-section.component.html",
  styleUrl: "./asset-section.component.scss",
})
export class AssetSectionComponent implements OnInit {
  @Input() employeeId: number |undefined | null = null;
  @Input() employeeHasAssets: EmployeeHasAsset[] = [];

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;

  localization = Localization;
  headerTitleAsset: string = `${$localize`Assets`} ${$localize`List`}`;
  assets = new Asset();
  Asset = Asset;
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'EmployeeHasAssets',
    pageSize: 50,
    expand: 'asset',
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitleAsset,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };


  ngOnInit(): void {
    this.columns = this.buildColumns();
  }

  ngOnChanges(): void {
    this.agGridRef?.refreshGridData(true);
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'asset_name',
        headerName: $localize`Asset`,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.asset?.name ?? '',
      },
      {
        field: 'issued_date',
        headerName: $localize`Issue Date`,
        minWidth: 130,
      },
      {
        field: 'return_date',
        headerName: $localize`Return Date`,
        minWidth: 130,
      },
      {
        field: 'remarks',
        headerName: $localize`Remarks`,
        minWidth: 150,
      },
      {
        field: 'note',
        headerName: $localize`Note`,
        minWidth: 150,
      },
    ];
  }
}
