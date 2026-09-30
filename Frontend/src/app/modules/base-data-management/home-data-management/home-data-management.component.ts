import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Localization } from '@shared/utilities/localization';
import { Permissions } from '@app/shared/enums/permissions';
import { BusyIndicatorComponent } from "@ui5/webcomponents-ngx";
@Component({
  selector: 'app-home-data-management',
  standalone: true,
  imports: [RouterLink, CommonModule, BusyIndicatorComponent],
  templateUrl: './home-data-management.component.html',
  styleUrl: './home-data-management.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HomeDataManagementComponent implements OnInit {
  CountData: any = {
    products: '',
    employees: '',
    machines: '',
    client: '',
    plants: '',
    supplier: '',
    storage_location: '',
    operations: '',
    handlingunits: '',
    assets: '',
  };
  IsLoading: boolean = false;
  permissions: { [key: string]: boolean } = {};
  CountArray: any[] = [];
  public localization = Localization;
  public Permissions = Permissions;

  constructor(
    private commonServices: CommonService,
    private rolePermissionService: RolePermissionService
  ) {
    this.GetCountValue();
  }

  ngOnInit(): void {
    this.permissions = this.rolePermissionService.getAllPermissionsStatus();
  }

  BatchApi() {
    return {
      requests: [
        {
          id: '1',
          method: 'GET',
          url: "/odata/Products?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
        {
          id: '2',
          method: 'GET',
          url: "/odata/Employees?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
        {
          id: '3',
          method: 'GET',
          url: "/odata/Clients?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
        {
          id: '4',
          method: 'GET',
          url: "/odata/Machines?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
        {
          id: '5',
          method: 'GET',
          url: "/odata/Plants?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
        {
          id: '6',
          method: 'GET',
          url: "/odata/Suppliers?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
        {
          id: '7',
          method: 'GET',
          url: "/odata/StorageLocations?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
        {
          id: '8',
          method: 'GET',
          url: "/odata/Operations?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
        {
          id: '9',
          method: 'GET',
          url: "/odata/HandlingUnits?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
        {
          id: '10',
          method: 'GET',
          url: "/odata/Assets?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
      ],
    };
  }

  GetCountValue() {
    this.IsLoading = true;
    this.commonServices
      .post('$batch', this.BatchApi(), this.commonServices.odata)
      .subscribe({
        next: (res: any) => {
          this.CountArray = [
            {
              name: $localize`Items`,
              count: res.responses[0].body['@count'],
              icon: 'product',
              permission: this.permissions[Permissions.BASE_DATA_ITEM],
              route: 'products',
            },
            {
              name: $localize`Employees`,
              count: res.responses[1].body['@count'],
              icon: 'group',
              permission: this.permissions[Permissions.HR_EMPLOYEE],
              route: 'employees',
            },
            {
              name: $localize`Clients`,
              count: res.responses[2].body['@count'],
              icon: 'key-user-settings',
              permission: this.permissions[Permissions.BASE_DATA_CLIENT],
              route: 'client',
            },
            {
              name: $localize`Machines`,
              count: res.responses[3].body['@count'],
              icon: 'action-settings',
              permission: this.permissions[Permissions.BASE_DATA_MACHINE],
              route: 'machines',
            },
            {
              name: $localize`Plants`,
              count: res.responses[4].body['@count'],
              icon: 'multi-select',
              permission: this.permissions[Permissions.BASE_DATA_PLANT],
              route: 'plants',
            },
            {
              name: $localize`Suppliers`,
              count: res.responses[5].body['@count'],
              icon: 'key-user-settings',
              permission: this.permissions[Permissions.BASE_DATA_SUPPLIER],
              route: 'supplier',
            },
            {
              name: $localize`Storage Locations`,
              count: res.responses[6].body['@count'],
              icon: 'retail-store-manager',
              permission: this.permissions[Permissions.BASE_DATA_STORAGE_LOCATION],
              route: 'storage-location',
            },
            {
              name: $localize`Operations`,
              count: res.responses[7].body['@count'],
              icon: 'developer-settings',
              permission: this.permissions[Permissions.BASE_DATA_OPERATION],
              route: 'operations',
            },
            {
              name: $localize`Tools->Handling Units`,
              count: res.responses[8].body['@count'],
              icon: 'technical-object',
              permission: this.permissions[Permissions.BASE_DATA_TOOLS],
              route: 'handling-units',
            },
            {
              name: $localize`Assets`,
              count: res.responses[9].body['@count'],
              icon: 'bbyd-dashboard',
              permission: this.permissions[Permissions.BASE_DATA_ASSET],
              route: 'asset-list',
            },
            {
              name: $localize`Roles->Permissions`,
              icon: 'permission',
              arrow: 'arrow-right',
              permission: this.permissions[Permissions.BASE_DATA_ROLE_PERMISSION],
              route: 'roles-permissions',
            },
            {
              name: $localize`User Management`,
              icon: 'account',
              arrow: 'arrow-right',
              permission: this.permissions[Permissions.BASE_DATA_USER],
              route: 'user-management',
            },
            {
              name: $localize`Activity`,
              icon: 'history',
              arrow: 'arrow-right',
              permission: this.permissions[Permissions.BASE_DATA_ACTIVITY_LOG],
              route: 'activity-log',
            },
          ];
          this.IsLoading = false;
        },
        error: (err) => {
          this.IsLoading = false;
        },
      });
  }
}
