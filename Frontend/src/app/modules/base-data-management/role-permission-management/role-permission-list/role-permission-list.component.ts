import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { Permission } from "@app/shared/model/permission";
import { Role } from "@app/shared/model/role";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { RoleFormComponent } from "@app/modules/base-data-management/role-permission-management/role-form/role-form.component";
import { saveMode } from "@shared/enums/saveMode";
import { ToastService } from "@app/services/toast-service/toast.service";
import { Localization } from "@shared/utilities/localization";
import { PermissionGroup } from "@app/services/role-permission-service/role-permission.service";
import {
  AgGridTableColumn,
  AgGridTableComponent,
} from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridCustomButton,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";

@Component({
  selector: "app-role-permission-list",
  templateUrl: "./role-permission-list.component.html",
  styleUrl: "./role-permission-list.component.scss",
})
export class RolePermissionListComponent implements OnInit {
  @ViewChild("roleForm") roleFormRef!: RoleFormComponent;
  @ViewChild("agRoleGridRef") agRoleGridRef!: AgGridTableComponent;
  @ViewChild("agPermissionGridRef") agPermissionGridRef!: AgGridTableComponent;
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  disableRow: (row: any) => boolean = () => true;
  enableRow: (row: any) => boolean = () => false;

  Roles = Role;
  permissionData: Permission[] = [];

  public localization = Localization;

  canRolePermisson: boolean = false;
  ToastType: string = "";
  isInsert: boolean = false;
  isRemovePermission: boolean = false;
  isDeleteLoading: boolean = false;
  groupsReady = false;
  roleTableLoading = true;

  get permissionGridLoading(): boolean {
    return !this.groupsReady || this.roleTableLoading || !this.selectedRole?.id;
  }
  selectedRole = new Role().deserialize({});
  selectedRemovePermission = new Permission().deserialize({});
  public saveMode: string = saveMode.POST;
  selectedPermission: Permission[] = [];
  odata: boolean;
  api: boolean;

  disableSelect: boolean = true;

  selectedRoleRowId: number | undefined = undefined;
  selectedPermissionList: number[] = [];
  selectedPermissionName: string[] = [];
  pendingRoleId: number | undefined = undefined;
  pendingRoleName: string | undefined = undefined;

  roleTableData: any[] = [];

  roleColumns: AgGridTableColumn<any>[] = [];
  roleGridId: string = "base-data-roles";
  roleDataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "Roles",
    expand: "syncPermissions",
    searchFields: ["name"],
    pageSize: 50,
  };
  roleToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: "Roles",
    showSearch: true,
    showRowCount: true,
    showNewButton: true,
  };

  roleActionButtons: AgGridCustomButton[] = [
    {
      id: "edit",
      icon: "edit",
      design: "Transparent",
      tooltip: "Edit",
      disable: (row: any) => row?.name === "super-admin" || row?.name === "employee",
      onClick: (row: any) => this.editRole(row),
    },
    {
      id: "delete",
      icon: "delete",
      design: "Negative",
      tooltip: "Delete",
      disable: (row: any) => row?.name === "super-admin" || row?.name === "employee",
      onClick: (row: any) => this.deleteRole(row?.id),
    },
  ];

  permissions: { [key: string]: boolean } = {};

  constructor(
    private commonService: CommonService,
    private rolePermissionService: RolePermissionService,
    private toastService: ToastService,
  ) {
    this.odata = this.commonService.odata;
    this.api = this.commonService.api;
    this.getinititalPermissions();
    this.roleColumns = this.buildRoleColumns();
  }

  ngOnInit(): void {
    this.permissions = this.rolePermissionService.getAllPermissionsStatus();
    this.rolePermissionService.fetchAllGrouped().subscribe({
      next: (groups) => {
        this.permissionDataSource = {
          ...this.permissionDataSource,
          data: this.buildPermissionTreeData(groups),
        };
        this.groupsReady = true;
      },
      error: () => {
        this.groupsReady = true;
      },
    });
  }

  private buildRoleColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: "name",
        headerName: this.localization.Name,
        minWidth: 180,
        flex: 1,
      },
      {
        field: "created_at",
        headerName: this.localization.CreatedAt,
        minWidth: 130,
        filter: false,
        sortable: false,
      },
    ];
  }

  permissionColumns: AgGridTableColumn<any>[] = [];

  permissionDataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };

  permissionToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: "",
    showSearch: true,
    showRowCount: false,
    showNewButton: false,
    showTableSettingBtn: false,
  };

  private _programmaticSelection = false;

  private buildPermissionTreeData(groups: PermissionGroup[]): any[] {
    const rows: any[] = [];
    groups.forEach((group) => {
      const groupId = `grp__${group.group}`;
      rows.push({ id: groupId, name: group.group, _level: 0, _parentId: null, _isLeaf: false });
      group.permissions.forEach((perm) => {
        rows.push({ id: perm.name, name: perm.name, _level: 1, _parentId: groupId, _isLeaf: true });
      });
    });
    return rows;
  }

  setSelectedTableData() {
    const gridApi = this.agPermissionGridRef?.getGridApi();
    if (!gridApi) return;

    this.disableSelect = this.selectedRole.name === "super-admin";

    this._programmaticSelection = true;
    gridApi.deselectAll();

    const nodes: any[] = [];
    gridApi.forEachNode((node) => {
      if (!node.data?._isLeaf) return;
      if (this.disableSelect || this.selectedPermissionName.includes(node.data.name)) {
        nodes.push(node);
      }
    });
    if (nodes.length) {
      gridApi.setNodesSelected({ nodes, newValue: true, source: "api" });
    }

    this._programmaticSelection = false;
    gridApi.refreshCells({ columns: ["__selection__"], force: true });
  }

  handleRoleTableData(event: any) {
    this.roleTableLoading = false;
    const data = Array.isArray(event) ? event[0] : event;
    if (!Array.isArray(data) || data.length === 0) {
      this.roleTableData = [];
      this.selectedRole = new Role().deserialize({});
      this.selectedRoleRowId = undefined;
      this.selectedPermissionName = [];
      this.setSelectedTableData();
      return;
    }

    this.roleTableData = data;

    let selectedIndex = -1;
    if (this.pendingRoleId !== undefined) {
      selectedIndex = data.findIndex(
        (role: Role) => role.id === this.pendingRoleId,
      );
    }
    if (selectedIndex < 0 && this.pendingRoleName) {
      selectedIndex = data.findIndex(
        (role: Role) => role.name === this.pendingRoleName,
      );
    }
    if (selectedIndex < 0 && this.selectedRole?.id) {
      selectedIndex = data.findIndex(
        (role: Role) => role.id === this.selectedRole.id,
      );
    }
    if (selectedIndex < 0) {
      selectedIndex = 0;
    }

    this.pendingRoleId = undefined;
    this.pendingRoleName = undefined;
    this.applyRoleSelection(data[selectedIndex], selectedIndex);

    const targetId = String(data[selectedIndex]?.id ?? "");
    setTimeout(() => {
      const api = this.agRoleGridRef?.getGridApi();
      if (!api || !targetId) return;
      api.forEachNode((node) => {
        if (String(node.data?.id ?? "") === targetId) node.setSelected(true, false, "api");
      });
    }, 0);
  }

  handlePermissionResponseData(value: any) {
    if (value.length === 0) {
      this.selectedPermission = [];
      return;
    }
    this.selectedPermission = value;
  }

  newRole() {
    this.selectedRole = new Role().deserialize({});
    this.roleFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  refreshRole() {
    this.agRoleGridRef?.refreshGridData(true);
  }

  editRole(data: any) {
    if (data?.name === "super-admin" || data?.name === "employee") return;
    this.roleFormRef.open = true;
    this.roleFormRef.role.deserialize(data);
    this.saveMode = saveMode.PUT;
  }

  deleteRole(id: any) {
    this.IsDelete.emit(`Roles/${id}`);
  }

  handleRoleSaved(event: any) {
    if (this.saveMode === saveMode.POST) {
      this.pendingRoleId = event?.response?.id ?? event?.id;
      this.pendingRoleName =
        event?.response?.name ?? event?.role?.name ?? undefined;
    }
    this.refreshRole();
  }

  handleRowSelect(selectedData: any) {
    if (!selectedData) return;
    const index = this.roleTableData.findIndex(
      (r: any) => r.id === selectedData.id,
    );
    this.applyRoleSelection(selectedData, index >= 0 ? index : 0);
  }

  onPermissionSelectionChanged(leafRows: any[]) {
    if (this._programmaticSelection || this.disableSelect) return;
    this.selectedPermissionName = leafRows
      .map((r: any) => r.name)
      .filter((name: string | undefined): name is string => !!name);
    this.selectedPermissionList = [];
  }

  submitPermission() {
    if (!this.selectedRole?.id) {
      this.toastService.show("error");
      return;
    }
    const payload = {
      id: this.selectedRole.id,
      syncPermissions: this.getSelectedPermissionIds().map((id) => ({ id })),
    };
    this.commonService.post("permissions", payload, this.api).subscribe({
      next: () => {
        this.refreshRole();
        this.toastService.show("add");
      },
      error: () => {
        this.toastService.show("error");
      },
    });
  }

  onCancel() {
    if (this.selectedRoleRowId !== undefined) {
      const roleData = this.roleTableData[this.selectedRoleRowId];
      if (roleData) {
        this.applyRoleSelection(roleData, this.selectedRoleRowId);
        return;
      }
    }
    this.selectedRole = new Role().deserialize({});
    this.selectedRoleRowId = undefined;
    this.selectedPermissionName = [];
    this.setSelectedTableData();
  }

  private applyRoleSelection(roleData: any, rowIndex: number) {
    this.selectedPermissionList = (roleData.syncPermissions ?? [])
      .map((perm: Permission) => perm.id)
      .filter((id: number | undefined): id is number => id !== undefined);
    this.selectedPermissionName = (roleData.syncPermissions ?? [])
      .map((perm: Permission) => perm.name)
      .filter((name: string | undefined): name is string => !!name);
    this.selectedRole = this.selectedRole.deserialize(roleData);
    this.selectedRoleRowId = rowIndex;
    this.setSelectedTableData();
  }

  getinititalPermissions() {
    this.commonService.get("Permissions?$top=3000", true).subscribe({
      next: (response: any) => {
        this.permissionData = response.value;
      },
      error: (error: any) => {
        console.error("Error fetching permissions:", error);
      },
    });
  }

  getSelectedPermissionIds(): number[] {
    if (!this.permissionData?.length || !this.selectedPermissionName?.length) {
      return [];
    }
    return this.permissionData
      .filter((perm: Permission) =>
        this.selectedPermissionName.includes(perm.name),
      )
      .map((perm: Permission) => perm.id)
      .filter((id): id is number => id !== undefined);
  }
}
