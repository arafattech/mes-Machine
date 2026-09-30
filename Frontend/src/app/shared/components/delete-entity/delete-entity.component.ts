import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Localization } from '@shared/utilities/localization';
import { ToasterComponent } from "../toaster/toaster.component";

@Component({
  selector: 'app-delete-entity',
  standalone: true,
  imports: [Ui5MainModule, CommonModule, ToasterComponent],
  templateUrl: './delete-entity.component.html',
  styleUrl: './delete-entity.component.scss',
})
export class DeleteEntityComponent implements OnInit {
  @Output() isSuccess: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Input() IsDelete = new EventEmitter<any>();
  IsLoading: boolean = false;
  @Input() IsOdata: boolean = false;
  open: boolean = false;
  ApiUrl: string = '';
  public localization = Localization;
  constructor(
    private commonservice: CommonService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.IsDelete.subscribe((items) => {
      this.open = true;
      this.ApiUrl = items;
    });
  }

  Delete() {
    this.IsLoading = true;
    this.commonservice.delete(this.ApiUrl, this.IsOdata).subscribe({
      next: (response) => {
        this.closeDialog();
        this.isSuccess.emit();
        this.toastService.show('delete');
      },
      error: (error) => {
        console.error('Delete Error:', error);
        this.closeDialog();
        this.toastService.show('error');
      },
    });
  }
  closeDialog() {
    this.open = false;
    this.IsLoading = false;
  }
}
