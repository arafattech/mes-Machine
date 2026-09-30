import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { HandlingUnit } from '@shared/model/handlingUnit';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { saveMode } from '@shared/enums/saveMode';
import { UnitsFormComponent } from '@base-data-module/tools-management/handling-units/units-form/units-form.component';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableRowAction,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridActionCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';

@Component({
  selector: 'app-units-list',
  templateUrl: './units-list.component.html',
  styleUrl: './units-list.component.scss',
})
export class UnitsListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<HandlingUnit>;
  @ViewChild('unitsForm') unitsFormRef!: UnitsFormComponent;

  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  @Output() IsSuccessChange = new EventEmitter<any>();

  units = new HandlingUnit().deserialize({});
  public saveMode: string = saveMode.POST;
  public permissions = Permissions;

  gridId = 'base-data-handling-units-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<HandlingUnit> = {
    type: 'odata',
    endpoint: 'HandlingUnits',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: 'Unit List',
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: 'New',
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_HANDING_UNITS_CREATE,
    ),
  };


  constructor(public rolePermissionService: RolePermissionService) {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const canEdit = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_HANDING_UNITS_EDIT,
    );
    const canDelete = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_HANDING_UNITS_DELETE,
    );

    const rowActions: AgGridTableRowAction<any>[] = [];
    if (canEdit) {
      rowActions.push({ id: 'edit', label: '', icon: 'edit', tooltip: $localize`Edit` });
    }
    if (canDelete) {
      rowActions.push({
        id: 'delete',
        label: '',
        icon: 'delete',
        tooltip: $localize`Delete`,
        design: 'Negative',
      });
    }

    const cols: AgGridTableColumn<any>[] = [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'custom_id',
        headerName: $localize`ID`,
        minWidth: 100,
        width: 110,
      },
      {
        field: 'name',
        headerName: `${$localize`Unit`} ${$localize`Name`}`,
        minWidth: 180,
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
      },
    ];

    if (rowActions.length > 0) {
      cols.push({
        field: 'actions',
        headerName: $localize`Actions`,
        width: 140,
        minWidth: 140,
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: rowActions,
          onAction: (actionId: string, row: any) => {
            switch (actionId) {
              case 'edit':
                this.editUnit(row);
                break;
              case 'delete':
                this.deleteClick(row.id);
                break;
            }
          },
        },
      });
    }

    return cols;
  }

  newUnit(): void {
    this.units = new HandlingUnit().deserialize({});
    this.unitsFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editUnit(data: any): void {
    this.units = new HandlingUnit().deserialize(data);
    this.saveMode = saveMode.PUT;
    this.unitsFormRef.open = true;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`HandlingUnits/${id}`);
  }

  processData(event: any): void {
    this.IsSuccessChange.emit(event);
    this.agGridRef?.refreshGridData(true);
  }
}
