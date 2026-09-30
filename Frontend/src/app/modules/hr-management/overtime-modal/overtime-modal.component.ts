import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Localization } from '@app/shared/utilities/localization';
import moment from 'moment';

@Component({
  selector: 'app-overtime-modal',
  templateUrl: './overtime-modal.component.html',
})
export class OvertimeModalComponent implements OnInit {
  @Input() isOpen: boolean = false;
  @Input() attendanceLogId: number | null = null;
  @Input() employeeData: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() overtime_success = new EventEmitter<any>();

  localization = Localization;
  isLoading: boolean = false;
  overtimeCheckout: string = '';
  selectedTime: string = '';
  selectedDate: string = '';

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {

  }

  assignOvertime() {
    if(!this.attendanceLogId){
      this.toastService.show('error');
      return;
    }

    this.isLoading = true;
    const updateData = { has_overtime: true, };

    this.commonService
      .put(`AttendanceLogs(${this.attendanceLogId})`, updateData, true)
      .subscribe({
        next: (res: any) => {
          this.toastService.show('add');
          this.overtime_success.emit(res);
          this.closeDialog();
        },
        error: (err) => {
          console.error('Error assigning overtime:', err);
          this.toastService.show('error');
          this.isLoading = false;
        },
      });
  }

  closeDialog() {
    this.isLoading = false;
    this.isOpen = false;
    this.close.emit();
  }
}
