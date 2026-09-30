import { Component, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import { AgGridActionCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import {
  AgGridTableColumn,
  AgGridTableRowAction,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  GridTableColumnDataType,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';
import { ReminderFormComponent } from '@store-module/reminder/reminder-form/reminder-form.component';

@Component({
  selector: 'app-reminder',
  templateUrl: './reminder.component.html',
})
export class ReminderComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;
  @ViewChild('reminderForm') formRef!: ReminderFormComponent;

  public saveMode: 'POST' | 'PUT' = 'POST';
  public selectedData: any;
  public context: 'store' | 'purchase';

  constructor(route: ActivatedRoute) {
    this.context = route.snapshot.data['context'] === 'purchase' ? 'purchase' : 'store';
    this.toolbarConfig = { ...this.toolbarConfig, showNewButton: this.context === 'store' };
  }

  columns: AgGridTableColumn<any>[] = [
    { field: 'created_at', hide: true },
    {
      colId: 'mrr.custom_id',
      headerName: $localize`MRR No`,
      flex: 1,
      minWidth: 160,
      sortable: false,
      valueGetter: (p: any) => p.data?.mrr?.custom_id ?? '',
    },
    { field: 'message', headerName: $localize`Message`, flex: 2, minWidth: 200 },
    {
      field: 'reminder_date',
      headerName: $localize`Reminder Date`,
      minWidth: 130,
      dataType: GridTableColumnDataType.Date,
    },
    {
      field: 'is_read',
      headerName: $localize`Read`,
      minWidth: 100,
      width: 110,
      dataType: GridTableColumnDataType.Boolean,
    },
    {
      field: 'actions',
      headerName: $localize`Actions`,
      width: 90,
      minWidth: 90,
      pinned: 'right',
      lockPinned: true,
      sortable: false,
      filter: false,
      floatingFilter: false,
      editable: false,
      cellRenderer: AgGridActionCellRendererComponent,
      cellRendererParams: {
        actions: [
          {
            id: 'edit',
            label: '',
            icon: 'edit',
            tooltip: $localize`Edit`,
            design: 'Default',
            visible: (row: any) => !row.is_read,
          },
          {
            id: 'info',
            label: '',
            icon: 'information',
            tooltip: $localize`Already marked as read — cannot edit`,
            design: 'Transparent',
            visible: (row: any) => !!row.is_read,
          },
        ] as AgGridTableRowAction<any>[],
        onAction: (actionId: string, row: any) => {
          if (actionId === 'edit' && !row.is_read) this.editItem(row);
          if (actionId === 'info') this.viewItem(row);
        },
      },
    },
  ];

  segmentButtonItems = [
    { id: 'all', name: $localize`All`, defaultSelect: true },
    { id: 'unread', name: $localize`Unread` },
    { id: 'read', name: $localize`Read` },
  ];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'Reminders',
    expand: 'mrr',
    pageSize: 50,
    searchFields: ['message', 'mrr.custom_id'],
    sortBy: 'created_at',
    sortDirection: 'desc',
    filter: this.statusFilter('all'),
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Reminders`,
    showRowCount: true,
    showSearch: true,
    showNewButton: true,
    addButtonText: $localize`New`,
    showDownload: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 118px)',
  };

  private statusFilter(segment: string): string | undefined {
    if (segment === 'unread') return 'is_read eq false';
    if (segment === 'read') return 'is_read eq true';
    return undefined;
  }

  segmentButtonChange(event: any): void {
    this.dataSource = {
      ...this.dataSource,
      filter: this.statusFilter(event?.id ?? event?.value),
    };
  }

  newItem(): void {
    this.saveMode = 'POST';
    this.formRef.saveMode = 'POST';
    this.formRef.viewOnly = false;
    this.formRef.reset();
    this.formRef.open = true;
  }

  editItem(row: any): void {
    this.saveMode = 'PUT';
    this.selectedData = row;
    this.formRef.saveMode = 'PUT';
    this.formRef.selectedData = row;
    this.formRef.viewOnly = false;
    this.formRef.populate(row);
    this.formRef.open = true;
  }

  viewItem(row: any): void {
    this.saveMode = 'PUT';
    this.selectedData = row;
    this.formRef.saveMode = 'PUT';
    this.formRef.selectedData = row;
    this.formRef.viewOnly = true;
    this.formRef.populate(row);
    this.formRef.open = true;
  }

  saveEvent(): void {
    this.agGridRef?.refreshGridData(true);
  }
}
