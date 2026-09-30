import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { ClientNote } from '@shared/model/clientNote';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { saveMode } from '@shared/enums/saveMode';
import { ClientNoteFormComponent } from '@base-data-module/client-management/client-notes/client-note-form/client-note-form.component';
import { Localization } from '@app/shared/utilities/localization';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-notes-list',
  templateUrl: './notes-list.component.html',
  styleUrl: './notes-list.component.scss',
})
export class NotesListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<ClientNote>;
  @ViewChild('clientNoteForm') clientNoteFormRef!: ClientNoteFormComponent;

  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  ClientNote = new ClientNote().deserialize({});

  gridId = 'base-data-client-note-list';
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<ClientNote> = {
    type: 'odata',
    endpoint: 'ClientNotes',
    searchFields: ['name', 'custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Client`} ${$localize`Note`}`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(Permissions.BASE_DATA_CLIENT_NOTE_CREATE),
  };

  constructor(public rolePermissionService: RolePermissionService) {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
    {
      field: 'is_active',
      headerName: $localize`Active`,
      minWidth: 80,
      width: 90,
      cellRenderer: AgGridBooleanCellRendererComponent,
      filter: false,
      sortable: false,
      floatingFilter: false,
    },
    {
      field: 'custom_id',
      headerName: $localize`ID`,
      minWidth: 100,
    },
    {
      field: 'name',
      headerName: `${$localize`Note`} ${$localize`Name`}`,
      minWidth: 180,
    },
    {
      field: 'created_at',
      headerName: Localization.CreatedAt,
      minWidth: 130,
      filter: false,
      floatingFilter: false,
        },
    ];
  }

  processData(_event?: any): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
  }

  newClientNote(): void {
    this.ClientNote = new ClientNote().deserialize({});
    this.clientNoteFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editClientNote(data: any): void {
    this.ClientNote = new ClientNote().deserialize(data);
    this.clientNoteFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`ClientNotes/${id}`);
  }
}
