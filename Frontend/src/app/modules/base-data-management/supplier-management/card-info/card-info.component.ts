import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
@Component({
  selector: 'app-card-info',
  templateUrl: './card-info.component.html',
  styleUrls: ['./card-info.component.scss'],
})
export class CardInfoComponent {
  @Input() tabId: string = '';
  @Input() tabText: string = '';
  @Input() items: any[] = [];
  @Input() selectedTab: string = '';
  @Input() icon: string = 'money-bills';
  @Input() fields: { label: string; key: string; format?: string }[] = [];
  @Input() newButtonText: string = 'New';
  @Input() defaultTitle: string = '';
  @Output() openModal: EventEmitter<void> = new EventEmitter();
  @Output() editItem: EventEmitter<any> = new EventEmitter();
  @Output() deleteItemFromServer: EventEmitter<number> = new EventEmitter();
  @Output() deleteItemLocal: EventEmitter<number> = new EventEmitter();

  public permissions = Permissions;

  isSelected(): boolean {
    return this.selectedTab === this.tabId;
  }
  constructor( public rolePermissionService: RolePermissionService) {}
}
