import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import ValueState from '@ui5/webcomponents-base/dist/types/ValueState.js';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Role } from '@shared/model/role';
import { User } from '@shared/model/user';
import { AssosiateComponent } from '@shared/components/assosiate/assosiate.component';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
})
export class UserFormComponent implements OnInit {
  @ViewChild('roleListGrid') roleListGridRef!: AgGridTableComponent<Role>;
  @ViewChild('roleAssociate') roleAssociateRef!: AssosiateComponent;
  @Input() saveMode = 'POST';
  @Input() user: User = new User();
  @Output() RefreshTable = new EventEmitter<void>();

  open = false;
  loading = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  selectedTab = 'coreData';
  message_strip = false;
  duplicate_error = '';
  RoleList = Role;
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public localization = Localization;

  private _roles: Role[] = [];
  get Roles(): Role[] { return this._roles; }
  set Roles(value: Role[]) {
    this._roles = value;
    this.roleDataSource = { ...this.roleDataSource, data: [...this._roles] };
  }

  valueStateOptions = {
    name: ValueState.None,
    email: ValueState.None,
    phone: ValueState.None,
    password: ValueState.None,
  };

  roleDataSource: AgGridTableODataSourceConfig<Role> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  roleToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Roles`} ${$localize`List`}`,
    showNewButton: true,
    addButtonText: $localize`Associate`,
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
  };

  roleDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 460px)',
    fillEmptyRows: true,
  };

  roleColumns: AgGridTableColumn<Role>[] = [
    {
      field: 'is_active',
      headerName: $localize`Active`,
      cellRenderer: AgGridBooleanCellRendererComponent,
      minWidth: 80,
      width: 90,
      filter: false,
      sortable: false,
    },
    {
      field: 'name',
      headerName: $localize`Name`,
      minWidth: 180,
      flex: 1,
    },
    {
      field: 'created_at',
      headerName: Localization.CreatedAt,
      minWidth: 130,
      width: 150,
      filter: false,
    },
  ];

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.selectedTab = 'coreData';
  }

  checkValidation(event: any, field: string): void {
    const value = event.target.value;
    switch (field) {
      case 'name':
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.user.name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;
      case 'email':
        if (value.trim() && !value.includes('@')) {
          this.valueStateOptions.email = ValueState.Negative;
          this.validationMessage = $localize`Please enter a valid email address.`;
        } else {
          this.user.email = value;
          this.valueStateOptions.email = ValueState.None;
        }
        break;
      case 'phone':
        this.user.phone = value;
        this.valueStateOptions.phone = ValueState.None;
        break;
      case 'password':
        if (!value && this.saveMode === saveMode.PUT) {
          this.valueStateOptions.password = ValueState.Negative;
        } else if (value.length < 6) {
          this.valueStateOptions.password = ValueState.Negative;
          this.validationMessage = $localize`Password must be at least 6 characters.`;
        } else {
          this.user.password = value;
          this.valueStateOptions.password = ValueState.None;
        }
        break;
    }
  }

  userValidation(): boolean {
    let isValid = true;

    if (!this.user.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      this.validationMessage = Localization.requiredField;
      isValid = false;
    } else {
      this.valueStateOptions.name = ValueState.None;
    }

    if (this.user.email?.trim() || this.user.phone?.trim()) {
      if (this.user.email?.trim() && !this.user.email.includes('@')) {
        this.valueStateOptions.email = ValueState.Negative;
        this.validationMessage = $localize`Please enter a valid email address.`;
        isValid = false;
      } else {
        this.valueStateOptions.email = ValueState.None;
      }
      this.valueStateOptions.phone = ValueState.None;
    } else {
      this.valueStateOptions.email = ValueState.Negative;
      this.valueStateOptions.phone = ValueState.Negative;
      this.validationMessage = $localize`Either email or phone is required.`;
      isValid = false;
    }

    const password = this.user.password?.trim();
    if (this.saveMode !== 'PUT') {
      if (!password) {
        this.valueStateOptions.password = ValueState.Negative;
        this.validationMessage = Localization.requiredField;
        isValid = false;
      } else if (password.length < 6) {
        this.valueStateOptions.password = ValueState.Negative;
        this.validationMessage = $localize`Password must be at least 6 characters.`;
        isValid = false;
      } else {
        this.valueStateOptions.password = ValueState.None;
      }
    } else {
      if (password && password.length < 6) {
        this.valueStateOptions.password = ValueState.Negative;
        this.validationMessage = $localize`Password must be at least 6 characters.`;
        isValid = false;
      } else {
        this.valueStateOptions.password = ValueState.None;
      }
    }

    return isValid;
  }

  associateTableColumn(): { accessor: string }[] {
    return [{ accessor: 'name' }];
  }

  isRoleAssociate(): void {
    this.roleAssociateRef.open = true;
    this.roleAssociateRef.bindingData = this.Roles;
  }

  removeRoleData(item: Role): void {
    this.Roles = this.Roles.filter((r: Role) => r.id !== item.id);
  }

  getRoleFromAssosiate(selectedItems: Role[]): void {
    this.Roles = [...selectedItems];
  }

  onUserSave(): void {
    if (!this.userValidation()) return;

    this.loading = true;
    const data = { userInfo: this.user, roles: this.Roles };
    let request$;

    if (this.saveMode === saveMode.POST) {
      this.ToastType = 'add';
      request$ = this.commonService.post('add/user', data, false);
    } else if (this.saveMode === saveMode.PUT) {
      this.ToastType = 'edit';
      request$ = this.commonService.put(`edit/user/${this.user.id}`, data, false);
    }

    if (request$) {
      request$.subscribe({
        next: (_res: any) => {
          this.CloseDialog();
          this.RefreshTable.emit();
          this.toastService.show(this.ToastType);
        },
        error: (error: any) => {
          this.loading = false;
          if (error.error?.message) {
            this.message_strip = true;
            this.duplicate_error = error.error.message;
            this.selectedTab = 'coreData';
          }
          this.toastService.show('error');
        },
      });
    }
  }

  onTabSelect(event: any): void {
    this.selectedTab = event.detail.tab.id;
  }

  CloseDialog(): void {
    this.user = new User().deserialize({});
    this.Roles = [];
    this.open = false;
    this.loading = false;
    this.selectedTab = 'coreData';
    this.message_strip = false;
    this.duplicate_error = '';
  }
}
