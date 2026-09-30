import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { CommonModule } from '@angular/common';
import { ToasterMessageComponent } from '@shared/components/toaster-message/toaster-message.component';
import {
  BusyIndicatorComponent,
  ButtonComponent,
  DialogComponent,
} from '@ui5/webcomponents-ngx';
import { ActivityLog } from '@shared/model/activitylog';
import { LogInfoComponent } from '@base-data-module/activity-management/log-info/log-info.component';
import { Localization } from '@shared/utilities/localization';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridActionCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-log-list',
  standalone: true,
  imports: [
    AgGridTableComponent,
    ButtonComponent,
    DialogComponent,
    BusyIndicatorComponent,
    CommonModule,
    ToasterMessageComponent,
    LogInfoComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './log-list.component.html',
  styleUrl: './log-list.component.scss',
})
export class LogListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<ActivityLog>;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() IsOpenLogInfo = new EventEmitter<void>();

  public localize = Localization;
  public localization = Localization;
  isEdit: boolean = false;
  IsDelete: boolean = false;
  Loading: boolean = false;
  ToastType: string = '';
  seletedlog = new ActivityLog();

  gridId = 'base-data-activity-log-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<ActivityLog> = {
    type: 'odata',
    endpoint: 'ActivityLogs',
    searchFields: ['user_name', 'model_custom_id', 'action_type'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${Localization.Activity} ${Localization.Logs}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
  };


  constructor(private CommonService: CommonService) {
    this.columns = this.buildColumns();
  }

  getModelName(modelType: string | undefined): string {
    return modelType?.split('\\').pop() || 'Unknown Model';
  }

  buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      { field: 'custom_id', headerName: $localize`ID`, minWidth: 100 },
      {
        field: 'model_type',
        headerName: `${Localization.Table} ${Localization.Name}`,
        minWidth: 180,
        valueFormatter: ({ value }: any) => this.getModelName(value),
      },
      {
        field: 'model_custom_id',
        headerName: `${Localization.Table} ${Localization.ID}`,
        minWidth: 120,
      },
      {
        field: 'action_type',
        headerName: `${Localization.Actions} ${Localization.Type}`,
        minWidth: 140,
      },
      {
        field: 'user_name',
        headerName: `${Localization.Users} ${Localization.Name}`,
        minWidth: 160,
      },
      {
        field: 'ip_address',
        headerName: `${Localization.IP} ${Localization.Address}`,
        minWidth: 140,
      },
      {
        field: 'created_at',
        headerName: Localization.CreatedAt,
        minWidth: 130,
        filter: false,
      },
      {
        field: 'actions',
        headerName: $localize`Actions`,
        width: 110,
        minWidth: 110,
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: [
            {
              id: 'info',
              icon: 'information',
              label: '',
              tooltip: $localize`View Details`,
            },
            {
              id: 'delete',
              icon: 'delete',
              label: '',
              tooltip: $localize`Delete`,
              design: 'Negative',
            },
          ],
          onAction: (actionId: string, row: any) => {
            if (actionId === 'info') this.logInfo(row);
            if (actionId === 'delete') {
              this.seletedlog.deserialize(row);
              this.IsDelete = true;
            }
          },
        },
      },
    ];
  }

  logInfo(log: ActivityLog): void {
    this.seletedlog = this.seletedlog.deserialize(log);
    this.IsOpenLogInfo.emit();
  }

  DeleteLog(): void {
    this.Loading = true;
    this.CommonService.delete(`ActivityLogs/${this.seletedlog.id}`).subscribe({
      next: (_res: any) => {
        this.ToastType = 'delete';
        this.refreshTable.emit();
        this.agGridRef?.refreshGridData(true);
        this.CloseDialog();
        setTimeout(() => {
          this.IsOpenToastAlert.emit();
        }, 100);
      },
      error: () => {
        this.ToastType = 'error';
        this.CloseDialog();
        setTimeout(() => {
          this.IsOpenToastAlert.emit();
        }, 100);
      },
    });
  }

  CloseDialog(): void {
    this.IsDelete = false;
    this.isEdit = false;
    this.Loading = false;
  }
}
