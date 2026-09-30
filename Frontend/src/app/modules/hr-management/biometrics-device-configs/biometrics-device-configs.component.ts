import {
  Component,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
} from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { Localization } from "@app/shared/utilities/localization";
import { BiometricConfigurations } from "@app/modules/hr-management/shared/models/biometricConfigurations";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { saveMode } from "@app/shared/enums/saveMode";
import { SocketService } from "@app/services/socket.service";
import { Subject, takeUntil } from "rxjs";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridTableColumn, AgGridTableODataSourceConfig, AgGridTableToolbarConfig, GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { DateFormatterService } from "@app/shared/utilities/date-format";

@Component({
  selector: "app-biometrics-device-configs",
  templateUrl: "./biometrics-device-configs.component.html",
  styleUrl: "./biometrics-device-configs.component.scss",
})
export class BiometricsDeviceConfigsComponent {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  config = BiometricConfigurations;
  device: BiometricConfigurations = new BiometricConfigurations();
  columns: AgGridTableColumn<any>[] = [];
  public localization = Localization;
  public validationMessage = Localization.requiredField;
  saveMode = saveMode.POST;
  ToastType: "add" | "edit" | "error" = "add";
  isDialogOpen: boolean = false;
  isLoading: boolean = false;
  private readonly destroy$ = new Subject<void>();
  private readonly deviceStatusMap = new Map<string, any>();
  valueStateOptions = {
    name: ValueState.None,
    ip: ValueState.None,
  };

  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'BiometricsDeviceConfigs',
    pageSize: 50,
    searchFields: ['custom_id', 'name', 'ip', 'status'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Biometrics Device Configs`,
    addButtonText: $localize`New`,
    showSearch: true,
    showRowCount: true,
    showNewButton: this.checkPermission('HR_BIOMETRIC_CREATE'),
    showDownload: false,
    showScanner: false,
    showSegmentButton: true,
  };


  constructor(
    public rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
    private socketService: SocketService,
    private dateFormatter: DateFormatterService,
  ) {}

  ngOnInit(): void {
    this.columns = this.buildColumns();
    this.bindSocketEvents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  newConfig() {
    this.device = new BiometricConfigurations().deserialize({});
    this.saveMode = saveMode.POST;
    this.isDialogOpen = true;
  }

  editConfig(config: any) {
    this.device = new BiometricConfigurations().deserialize(config);
    this.saveMode = saveMode.PUT;
    this.isDialogOpen = true;
  }

  deleteConfig(row: any) {
    this.IsDelete.emit(`BiometricsDeviceConfigs/${row.id}`);
  }

  saveDevice() {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    let url = "";
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = "BiometricsDeviceConfigs";
      this.ToastType = "add";
      request$ = this.commonService.post(url, this.device.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `BiometricsDeviceConfigs(${this.device.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, this.device.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: async (res) => {
          await this.reloadBiometricDevices();
          this.CloseDialog();
          await this.processData(res);
          this.toastService.show(this.ToastType);
        },
        error: (error: any) => {
          this.isLoading = false;
          this.CloseDialog();
          this.toastService.show("error");
        },
      });
    }
  }

  checkPermission(data: string) {
    const permission = data;
    const isPermissions = this.rolePermissionService.hasPermission(permission);
    return isPermissions;
  }
  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "name":
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.device.name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;
      case "ip":
        if (!value.trim()) {
          this.valueStateOptions.ip = ValueState.Negative;
        } else {
          this.device.ip = value;
          this.valueStateOptions.ip = ValueState.None;
        }
        break;
      default:
        break;
    }
  }
  validateForm(): boolean {
    let isValid = true;
    if (!this.device.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    if (!this.device.ip?.trim()) {
      this.valueStateOptions.ip = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80, width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false, sortable: false, floatingFilter: false,
      },
      {
        field: 'custom_id',
        headerName: `${$localize`Custom`} ${$localize`ID`}`,
        minWidth: 120,
        sort: 'desc',
      },
      {
        field: 'name',
        headerName: $localize`Device Name`,
        minWidth: 150,
      },
      {
        field: 'ip',
        headerName: $localize`Device IP`,
        minWidth: 140,
      },
      {
        field: 'port',
        headerName: $localize`Device Port`,
        minWidth: 120,
        type: 'numericColumn',
      },
      {
        field: 'timeout',
        headerName: $localize`Timeout`,
        minWidth: 100,
        type: 'numericColumn',
      },
      {
        field: 'inport',
        headerName: $localize`Inport`,
        minWidth: 100,
        type: 'numericColumn',
      },
      {
        field: 'status',
        headerName: $localize`Status`,
        minWidth: 120,
        filter: false, floatingFilter: false,
        valueGetter: (params: any) => {
          const status = this.getDeviceStatus(params.data?.id);
          return this.normalizeDeviceStatus(status);
        },
      },
      {
        field: 'created_at',
        headerName: this.localization.CreatedAt,
        minWidth: 130,
        filter: false, floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
    ];
  }
  private bindSocketEvents() {
    this.socketService
      .on("biometrics_snapshot")
      .pipe(takeUntil(this.destroy$))
      .subscribe((payload: any) => {
        this.deviceStatusMap.clear();
        payload?.devices?.forEach((device: any) => {
          this.deviceStatusMap.set(String(device.id), device);
        });
        this.agGridRef?.refreshGridData(false);
      });

    this.socketService
      .on("biometrics_device_status")
      .pipe(takeUntil(this.destroy$))
      .subscribe((device: any) => {
        if (!device?.id) return;
        this.deviceStatusMap.set(String(device.id), device);
        this.agGridRef?.refreshGridData(false);
      });
  }

  private getDeviceStatus(id: string | number) {
    return this.deviceStatusMap.get(String(id));
  }

  private normalizeDeviceStatus(status: any) {
    const raw = String(status?.status ?? "").toLowerCase();
    if (raw === "connected") return "connected";
    if (raw === "reconnecting" || raw === "connecting") return "reconnecting";
    return "disconnected";
  }

  async processData(event?: any) {
    if (event === undefined) {
      await this.reloadBiometricDevices();
    }
    this.agGridRef?.refreshGridData(true);
  }

  private async reloadBiometricDevices() {
    this.socketService.emit("biometrics_reload");
  }
  CloseDialog() {
    this.isLoading = false;
    this.isDialogOpen = false;
    this.device = new BiometricConfigurations();
    this.valueStateOptions = {
      name: ValueState.None,
      ip: ValueState.None,
    };
  }
}
