import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BusyIndicatorComponent,
  ButtonComponent,
  DialogComponent,
} from '@ui5/webcomponents-ngx';
import { LoginActivity } from '@shared/model/loginActivity';
import { LoginActivityInfoComponent } from '@base-data-module/activity-management/login-activity-info/login-activity-info.component';
import { Localization } from '@shared/utilities/localization';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridActionCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';

@Component({
  selector: 'app-login-activity-list',
  standalone: true,
  imports: [
    AgGridTableComponent,
    ButtonComponent,
    DialogComponent,
    BusyIndicatorComponent,
    CommonModule,
    LoginActivityInfoComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './login-activity-list.component.html',
  styleUrl: './login-activity-list.component.scss',
})
export class LoginActivityListComponent {
  @Output() IsOpenLoginActivityInfo = new EventEmitter<void>();

  public localization = Localization;
  seletedActivity = new LoginActivity();

  gridId = 'base-data-login-activity-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<LoginActivity> = {
    type: 'odata',
    endpoint: 'LoginActivities',
    searchFields: ['user_name', 'ip_address'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Login Activity`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: false,
  };

  constructor() {
    this.columns = this.buildColumns();
  }

  buildColumns(): AgGridTableColumn<any>[] {
    return [
      { field: 'id', headerName: $localize`ID`, minWidth: 90 },
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
        field: 'login_date',
        headerName: $localize`Login Date`,
        minWidth: 130,
        filter: false,
      },
      {
        field: 'login_time',
        headerName: $localize`Login Time`,
        minWidth: 120,
        filter: false,
        valueFormatter: ({ value }: any) =>
          value ? new Date(value).toLocaleTimeString() : '',
      },
      {
        colId: 'logout_date',
        headerName: $localize`Logout Date`,
        minWidth: 130,
        filter: false,
        valueGetter: (params: any) => params.data?.logout_time ?? null,
        valueFormatter: ({ value }: any) =>
          value ? new Date(value).toLocaleDateString('en-GB') : '--',
      },
      {
        field: 'logout_time',
        headerName: $localize`Logout Time`,
        minWidth: 120,
        filter: false,
        valueFormatter: ({ value }: any) =>
          value ? new Date(value).toLocaleTimeString() : '--',
      },
      {
        field: 'actions',
        headerName: $localize`Actions`,
        width: 100,
        minWidth: 100,
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
          ],
          onAction: (actionId: string, row: any) => {
            if (actionId === 'info') this.activityInfo(row);
          },
        },
      },
    ];
  }

  activityInfo(activity: LoginActivity): void {
    this.seletedActivity = this.seletedActivity.deserialize(activity);
    this.IsOpenLoginActivityInfo.emit();
  }
}
