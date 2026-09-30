import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
@Component({
  selector: 'app-task-home-data-management',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './task-home-data-management.component.html',
  styleUrl: './task-home-data-management.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TaskHomeDataManagementComponent {
  CountData: any = {
    products: '',
  };
  IsLoading: boolean = false;
  permissions: { [key: string]: boolean } = {};
  constructor(
    private CommonServices: CommonService,
    private rolePermissionService: RolePermissionService
  ) {
    this.GetCountValue();
  }
  ngOnInit(): void {
    this.permissions = this.rolePermissionService.getAllPermissionsStatus();
  }

  CountArray: any | undefined;

  BatchApi() {
    const batchPayload = {
      requests: [
        {
          id: '1',
          method: 'GET',
          url: "/odata/SupplierBankInfos?$count=true&select='@count'",
          headers: { 'Content-Type': 'application/json' },
        },
      ],
    };
    return batchPayload;
  }

  GetCountValue() {
    this.IsLoading = true;
    this.CommonServices.post(
      '$batch',
      this.BatchApi(),
      this.CommonServices.odata
    ).subscribe({
      next: (res: any) => {
        Object.values(res).map((items: any) => {
          const counter = [
            {
              name: 'My Task',
              count: 0,
              icon: 'task',
              permission: this.permissions[Permissions.TASK_ADMIN],
              route: 'my-tasks',
            },
            {
              name: 'Assigned Task',
              count: items[0].body['@count'],
              icon: 'task',
              permission: this.permissions[Permissions.TASK_ADMIN],
              route: 'my-tasks',
            },
          ];

          this.CountArray = counter;
        });

        this.IsLoading = false;
      },
      error: (err) => {
        this.IsLoading = false;
      },
    });
  }
}
