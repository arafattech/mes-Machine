import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { Localization } from '@app/shared/utilities/localization';
import { YarnTransferAdvice } from '@store-module/shared/model/yarnTransferAdvice';
import { YarnAdviceStatus } from '@store-module/shared/enum/yarn-advice-status';
import { YarnAdviceFormComponent } from '@store-module/yarn-transfer-management/yarn-advice-form/yarn-advice-form.component';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import { AgGridStatusBadgeComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import {
  AgGridCustomButton,
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';

@Component({
  selector: 'app-yarn-transfer-list',
  templateUrl: './yarn-transfer-list.component.html',
})
export class YarnTransferListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<YarnTransferAdvice>;
  @ViewChild('transferFormRef') transferFormRef!: YarnAdviceFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  public permissions = Permissions;
  gridId = 'store-yarn-transfer-list';
  columns: AgGridTableColumn<any>[] = this.buildColumns();

  dataSource: AgGridTableODataSourceConfig<YarnTransferAdvice> = {
    type: 'odata',
    // No trailing "s" — Lodata pluralizes entity set names from the model class name, and
    // "Advice" is grammatically uncountable so it comes out unchanged, not "Advices".
    endpoint: 'YarnTransferAdvice',
    expand: 'fromHall,lines',
    searchFields: ['custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Yarn`} ${$localize`Transfer Advice`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.PRODUCTION_LOT_GTN_SUBMIT,
    ),
  };

  customActionButtons: AgGridCustomButton[] = [
    {
      id: 'edit',
      icon: 'edit',
      tooltip: $localize`Edit`,
      design: 'Transparent',
      disable: (row: any) => {
        const s = (row?.status ?? '').toLowerCase();
        return s === 'gm_approved' || s === YarnAdviceStatus.GM_APPROVED;
      },
      onClick: (row: any) => this.openEdit(row),
    },
    {
      id: 'info',
      icon: 'information',
      tooltip: $localize`Info`,
      design: 'Transparent',
      onClick: (row: any) => this.openView(row),
    },
    {
      id: 'delete',
      icon: 'delete',
      tooltip: $localize`Delete`,
      design: 'Negative',
      disable: (row: any) => {
        const s = (row?.status ?? '').toLowerCase();
        return s === 'gm_approved' || s === YarnAdviceStatus.GM_APPROVED;
      },
      onClick: (row: any) => this.deleteClick(row),
    },
  ];

  constructor(public rolePermissionService: RolePermissionService) {}

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      { field: 'custom_id', headerName: $localize`Advice No`, minWidth: 130 },
      {
        colId: 'fromHall.name',
        headerName: $localize`From Hall`,
        minWidth: 140,
        valueGetter: (p) => p.data?.fromHall?.name ?? '',
      },
      {
        field: 'transfer_date',
        headerName: $localize`Transfer Date`,
        minWidth: 140,
      },
      {
        colId: 'lines.length',
        headerName: $localize`Lines`,
        minWidth: 90,
        valueGetter: (p) => p.data?.lines?.length ?? 0,
      },
      {
        field: 'vehicle_no',
        headerName: $localize`Vehicle No`,
        minWidth: 130,
      },
      {
        field: 'status',
        headerName: $localize`Status`,
        minWidth: 140,
        cellRenderer: AgGridStatusBadgeComponent,
      },
      {
        field: 'created_at',
        headerName: Localization.CreatedAt,
        minWidth: 130,
        filter: false,
      },
    ];
  }

  processData(): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
  }

  newTransfer(): void {
    this.transferFormRef.openCreate();
  }

  openEdit(row: any): void {
    const s = (row?.status ?? '').toLowerCase();
    if (s === 'gm_approved' || s === YarnAdviceStatus.GM_APPROVED) {
      this.openView(row);
      return;
    }
    this.transferFormRef.openManage(new YarnTransferAdvice().deserialize(row), false);
  }

  openView(row: any): void {
    this.transferFormRef.openManage(new YarnTransferAdvice().deserialize(row), true);
  }

  deleteClick(data: any): void {
    const s = (typeof data === 'object' ? data?.status ?? '' : '').toLowerCase();
    if (s === 'gm_approved' || s === YarnAdviceStatus.GM_APPROVED) {
      return;
    }
    const id = typeof data === 'object' ? data?.id : data;
    this.IsDelete.emit(`YarnTransferAdvice(${id})`);
  }
}
