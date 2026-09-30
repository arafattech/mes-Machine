import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Permissions } from '@app/shared/enums/permissions';
import { Localization } from '@app/shared/utilities/localization';
import { saveMode } from '@shared/enums/saveMode';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import {
  ConfigChannelEntry,
  MachineConfig,
} from '@base-data-module/shared/model/MachineConfig';
import { Machine } from '@app/shared/model/machine';
import { MachineState } from '@app/shared/model/machineState';
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
  selector: 'app-machine-config',
  templateUrl: './machine-config.component.html',
  styleUrl: './machine-config.component.scss',
})
export class MachineConfigComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<MachineConfig>;
  @ViewChild('machineName') machineNameInput: any;

  @Output() refreshTable: EventEmitter<any> = new EventEmitter<any>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  permissions = Permissions;
  public localization = Localization;
  public valueState = ValueState;
  public saveMode: string = saveMode.POST;
  public open: boolean = false;
  public loading: boolean = false;
  public hasExistingMachineConfig: boolean = false;
  public duplicateConfigMessage: string =
    'Already exists a configuration for the selected machine.';

  Machines: Machine[] = [];
  machineConfig: MachineConfig = new MachineConfig().deserialize({});

  gridId = 'base-data-machine-config';
  columns: AgGridTableColumn<any>[] = [];

  protocolOptions = ['HTTP', 'HTTPS' , 'MQTT' , 'TCP'];
  //typeOptions = ['Cast/cast_sig', 'Cast', 'Signal'];
  readFromOptions = ['MQTT', 'API', 'MODBUS'];

  channelOptions: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  // This machine's tagged states (`machine_has_states`) — a channel can only be wired
  // to one of these, not the full `machine_states` table. Loaded per selected machine.
  machineStates: MachineState[] = [];

  valueStateOptions = {
    machine_name: ValueState.None,
    ip_plc: ValueState.None,
  };

  dataSource: AgGridTableODataSourceConfig<MachineConfig> = {
    type: 'odata',
    endpoint: 'MachineHasConfigs',
    expand: 'channels',
    searchFields: ['machine_name', 'ip_plc', 'config_id'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: 'Machines Configuration',
    showSearch: true,
    showScanner: true,
    showRowCount: true,
    showSegmentButton: true,
    addButtonText: 'New',
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_MACHINE_CONFIG_CREATE,
    ),
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    public rolePermissionService: RolePermissionService,
  ) {
    this.columns = this.buildColumns();
  }

  ngOnInit(): void {
    this.GetMachines();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const canEdit = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_MACHINE_CONFIG_EDIT,
    );
    const canDelete = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_MACHINE_CONFIG_DELETE,
    );

    const rowActions: AgGridTableRowAction<any>[] = [];
    if (canEdit) {
      rowActions.push({
        id: 'edit',
        label: '',
        icon: 'edit',
        tooltip: $localize`Edit`,
      });
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
        field: 'machine_name',
        headerName: $localize`Machine Name`,
        minWidth: 160,
      },
      {
        field: 'config_id',
        headerName: $localize`Config ID`,
        minWidth: 110,
        width: 120,
        hide: true,
      },
      {
        field: 'ip_plc',
        headerName: $localize`IP PLC`,
        minWidth: 140,
      },
      {
        field: 'protocol',
        headerName: $localize`Protocol`,
        minWidth: 100,
        width: 110,
      },
      {
        field: 'channels',
        headerName: $localize`Channels`,
        minWidth: 180,
        flex: 1,
        valueFormatter: ({ value }: any) => {
          if (!Array.isArray(value) || value.length === 0) {
            return '-';
          }
          return value
            .map((channel: any) => `CH-${channel.channel_id}: ${channel.status}`)
            .join(', ');
        },
      },
      {
        field: 'type',
        headerName: $localize`Type`,
        minWidth: 130,
        width: 140,
      },
      {
        field: 'read_from',
        headerName: $localize`Read From`,
        minWidth: 110,
        width: 120,
      },
      {
        field: 'timeout_sec',
        headerName: $localize`Timeout (sec)`,
        minWidth: 130,
        width: 140,
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
      },
      // Hidden migration columns
      {
        field: 'id_iot',
        headerName: $localize`IoT ID`,
        minWidth: 100,
        hide: true,
      },
      {
        field: 'ip_hmi',
        headerName: $localize`IP HMI`,
        minWidth: 120,
        hide: true,
      },
      { field: 'port', headerName: $localize`Port`, minWidth: 80, hide: true },
      {
        field: 'websocket_port',
        headerName: $localize`Websocket Port`,
        minWidth: 140,
        hide: true,
      },
      {
        field: 'max_rpm',
        headerName: $localize`Max RPM`,
        minWidth: 100,
        hide: true,
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
      },
      {
        field: 'min_rpm',
        headerName: $localize`Min RPM`,
        minWidth: 100,
        hide: true,
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
      },
      {
        field: 'max_temp',
        headerName: $localize`Max Temp`,
        minWidth: 100,
        hide: true,
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
      },
      {
        field: 'min_temp',
        headerName: $localize`Min Temp`,
        minWidth: 100,
        hide: true,
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
      },
      {
        field: 'shot_buffer',
        headerName: $localize`Shot Buffer`,
        minWidth: 110,
        hide: true,
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
      },
      {
        field: 'server_call_sec',
        headerName: $localize`Server Call (sec)`,
        minWidth: 150,
        hide: true,
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
      },
      {
        field: 'auto_signal',
        headerName: $localize`Auto Signal`,
        minWidth: 120,
        hide: true,
      },
      {
        field: 'shot_signal',
        headerName: $localize`Shot Signal`,
        minWidth: 120,
        hide: true,
      },
      {
        field: 'inverse_auto',
        headerName: $localize`Inverse Auto`,
        minWidth: 120,
        hide: true,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'inverse_shot',
        headerName: $localize`Inverse Shot`,
        minWidth: 120,
        hide: true,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'auto_independent',
        headerName: $localize`Auto Independent`,
        minWidth: 150,
        hide: true,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'active',
        headerName: $localize`Active (Flag)`,
        minWidth: 120,
        hide: true,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'scrap',
        headerName: $localize`Scrap`,
        minWidth: 80,
        hide: true,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'robot_active',
        headerName: $localize`Robot Active`,
        minWidth: 120,
        hide: true,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'robot',
        headerName: $localize`Robot`,
        minWidth: 100,
        hide: true,
      },
      {
        field: 'press_active',
        headerName: $localize`Press Active`,
        minWidth: 120,
        hide: true,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'press',
        headerName: $localize`Press`,
        minWidth: 100,
        hide: true,
      },
      {
        field: 'handling_active',
        headerName: $localize`Handling Active`,
        minWidth: 140,
        hide: true,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        field: 'handling',
        headerName: $localize`Handling`,
        minWidth: 100,
        hide: true,
      },
      {
        field: 'selection_type',
        headerName: $localize`Selection Type`,
        minWidth: 140,
        hide: true,
      },
      {
        field: 'heating_start',
        headerName: $localize`Heating Start`,
        minWidth: 150,
        hide: true,
        filter: false,
        valueFormatter: ({ value }: any) =>
          value ? new Date(value).toLocaleString() : '-',
      },
      {
        field: 'order_of_machine',
        headerName: $localize`Order`,
        minWidth: 80,
        hide: true,
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
      },
      {
        field: 'live_status_api',
        headerName: $localize`Live Status API`,
        minWidth: 150,
        hide: true,
      },
      {
        field: 'live_shot_api',
        headerName: $localize`Live Shot API`,
        minWidth: 150,
        hide: true,
      },
      {
        field: 'test_status_api',
        headerName: $localize`Test Status API`,
        minWidth: 150,
        hide: true,
      },
      {
        field: 'test_shot_api',
        headerName: $localize`Test Shot API`,
        minWidth: 150,
        hide: true,
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
                this.editConfig(row);
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

  GetMachines(): void {
    this.commonService.get('Machines', true).subscribe({
      next: (res: any) => {
        this.Machines = res.value;
      },
      error: () => {
        this.toastService.show('error');
      },
    });
  }

  newConfig(): void {
    this.saveMode = saveMode.POST;
    this.hasExistingMachineConfig = false;
    this.open = true;
  }

  editConfig(data: any): void {
    if (!data) return;
    this.saveMode = saveMode.PUT;
    this.machineConfig.deserialize(data);
    this.machineConfig.channels = this.normalizeChannels(data?.channels);
    this.open = true;
    if (this.machineConfig.machine_id) {
      this.loadMachineStates(this.machineConfig.machine_id);
    }
  }

  private normalizeChannels(raw: any): ConfigChannelEntry[] {
    let list = raw;
    if (typeof list === 'string') {
      try {
        list = JSON.parse(list);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(list)) return [];
    return list
      .map((entry: any) => ({
        channel_id: Number(entry?.channel_id),
        machine_state_id:
          entry?.machine_state_id != null ? Number(entry.machine_state_id) : null,
      }))
      .filter((entry: ConfigChannelEntry) => Number.isFinite(entry.channel_id));
  }

  /** This machine's tagged states (`machine_has_states`) — constrains which state a
   * channel can be wired to, matching the same rule the backend validates against. */
  private loadMachineStates(machineId: number): void {
    this.machineStates = [];
    this.commonService.get(`Machines(${machineId})?$expand=states`, true).subscribe({
      next: (res: any) => {
        this.machineStates = (res?.states ?? []).map((s: any) =>
          new MachineState().deserialize(s),
        );
      },
      error: () => {
        this.toastService.show('error');
      },
    });
  }

  isChannelSelected(channelId: number): boolean {
    return this.machineConfig.channels.some((e) => e.channel_id === channelId);
  }

  onChannelSelectionChange(event: any): void {
    const items = event?.detail?.items ?? [];
    const selectedChannelIds: number[] = items
      .map((item: any) => Number(item.id))
      .filter((channelId: number) => Number.isFinite(channelId));

    const previousStates = new Map(
      this.machineConfig.channels.map((e) => [e.channel_id, e.machine_state_id]),
    );
    const defaultStateId = this.machineStates[0]?.id ?? null;

    this.machineConfig.channels = selectedChannelIds.map((channelId) => ({
      channel_id: channelId,
      machine_state_id: previousStates.get(channelId) ?? defaultStateId,
    }));
  }

  onChannelStatusChange(channelId: number, event: any): void {
    const selectedOption = event?.detail?.selectedOption;
    const value = Number(selectedOption?.getAttribute('value'));
    const entry = this.machineConfig.channels.find((e) => e.channel_id === channelId);
    if (entry && Number.isFinite(value)) {
      entry.machine_state_id = value;
    }
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`MachineHasConfigs/${id}`);
  }

  removeSelectedConfiguration(): void {
    if (!this.machineConfig.id) return;
    this.IsDelete.emit(`MachineConfigs/${this.machineConfig.id}`);
    this.CloseDialog();
  }

  checkValidation(event: any, field: 'machine_name' | 'ip_plc'): void {
    const value = event.target.value ? event.target.value : '';
    switch (field) {
      case 'machine_name':
        if (!value.trim()) {
          this.valueStateOptions.machine_name = ValueState.Negative;
        } else {
          this.machineConfig.machine_name = value;
          this.valueStateOptions.machine_name = ValueState.None;
        }
        break;
      case 'ip_plc':
        if (!value.trim()) {
          this.valueStateOptions.ip_plc = ValueState.Negative;
        } else {
          this.machineConfig.ip_plc = value;
          this.valueStateOptions.ip_plc = ValueState.None;
        }
        break;
      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.machineConfig.machine_id) {
      this.valueStateOptions.machine_name = ValueState.Negative;
      isValid = false;
    }
    if (!this.machineConfig.ip_plc) {
      this.valueStateOptions.ip_plc = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  onMachineSelection(event: any): void {
    const selectedItem = event?.detail?.item;
    const selectedMachineId = Number(selectedItem?.value);
    const selectedMachineName = selectedItem?.text ?? '';

    this.machineConfig.machine_id = Number.isFinite(selectedMachineId)
      ? selectedMachineId
      : 0;
    this.machineConfig.machine_name = selectedMachineName;
    this.hasExistingMachineConfig = false;
    // Channel selections are tied to the previous machine's tagged states — not valid
    // for a different machine, so they're cleared alongside the states list itself.
    this.machineConfig.channels = [];
    this.machineStates = [];

    if (!this.machineConfig.machine_id) return;
    this.loadMachineStates(this.machineConfig.machine_id);

    if (this.saveMode !== saveMode.POST) return;

    this.commonService
      .get(
        `MachineHasConfigs?$filter=machine_id eq ${this.machineConfig.machine_id}`,
        true,
      )
      .subscribe({
        next: (res: any) => {
          this.hasExistingMachineConfig = (res?.value?.length ?? 0) > 0;
        },
        error: () => {
          this.hasExistingMachineConfig = false;
          this.toastService.show('error');
        },
      });
  }

  onSelectChange(field: keyof MachineConfig, event: any): void {
    const selectedOption = event?.detail?.selectedOption;
    if(selectedOption !== 'MQTT') this.machineConfig.id_iot = '';
    const value = selectedOption?.getAttribute('value') ?? '';
    (this.machineConfig as any)[field] = value;
  }

  onSwitchChange(field: keyof MachineConfig, event: any): void {
    const checked = Boolean(event?.target?.checked);
    (this.machineConfig as any)[field] = checked;
  }

  SaveConfig(): void {
    if (this.saveMode === saveMode.POST && this.hasExistingMachineConfig)
      return;
    if (!this.validateForm()) return;

    this.loading = true;
    let request$: any;

    if (this.saveMode === saveMode.POST) {
      request$ = this.commonService.post(
        'machine/configs',
        this.machineConfig,
        false,
      );
    } else {
      request$ = this.commonService.put(
        `machine/configs/${this.machineConfig.id}`,
        this.machineConfig,
        false,
      );
    }

    request$.subscribe({
      next: () => {
        this.toastService.show(
          this.saveMode === saveMode.POST ? 'add' : 'edit',
        );
        this.CloseDialog();
        this.processData();
      },
      error: (error: any) => {
        if (error?.status === 422) {
          this.hasExistingMachineConfig = true;
        }
        this.loading = false;
        this.toastService.show('error');
      },
    });
  }

  processData(event?: any): void {
    this.refreshTable.emit(event);
    this.agGridRef?.refreshGridData(true);
  }

  CloseDialog(): void {
    this.open = false;
    this.loading = false;
    this.hasExistingMachineConfig = false;
    this.valueStateOptions.machine_name = ValueState.None;
    this.valueStateOptions.ip_plc = ValueState.None;
    this.machineConfig = new MachineConfig().deserialize({});
    this.machineStates = [];
    if (this.machineNameInput) {
      this.machineNameInput.value = '';
    }
  }
}
