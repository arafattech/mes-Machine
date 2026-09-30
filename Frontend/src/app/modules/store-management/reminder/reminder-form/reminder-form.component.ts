import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AuthService } from '@app/services/auth-service/auth.service';
import { CommonService } from '@app/services/common-service/common.service';
import { SocketService } from '@app/services/socket.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';
import { DateFormatterService } from '@shared/utilities/date-format';
import { Localization } from '@shared/utilities/localization';
import moment from 'moment';

interface MrrOption {
  id: number;
  label: string;
}

interface ReminderForm {
  mrr_id: number | null;
  message: string;
  purchase_message: string;
  reminder_date: string;
  is_read: boolean;
}

@Component({
  selector: 'app-reminder-form',
  templateUrl: './reminder-form.component.html',
})
export class ReminderFormComponent implements OnInit {
  @Input() saveMode: 'POST' | 'PUT' = 'POST';
  @Input() selectedData: any;
  @Input() context: 'store' | 'purchase' = 'store';
  @Input() viewOnly = false;
  @Output() saveEvent = new EventEmitter<void>();

  open = false;
  loading = false;
  public localization = Localization;
  public validationMessage = Localization.requiredField;

  public mrrOptions: MrrOption[] = [];
  public mrrTitle = '';
  public reminder: ReminderForm = {
    mrr_id: null,
    message: '',
    purchase_message: '',
    reminder_date: '',
    is_read: false,
  };

  logColumns: AgGridTableColumn<any>[] = [
    {
      colId: 'product_name',
      headerName: $localize`Product`,
      flex: 1,
      minWidth: 160,
      sortable: false,
      filter: false,
      floatingFilter: false,
      valueGetter: (p: any) => p.data?.product?.product_name ?? '',
    },
    {
      field: 'required_quantity',
      headerName: $localize`Required Qty`,
      minWidth: 130,
      sortable: false,
      filter: false,
      floatingFilter: false,
      type: 'numericColumn',
    },
    {
      field: 'received_quantity',
      headerName: $localize`Received Qty`,
      minWidth: 130,
      sortable: false,
      filter: false,
      floatingFilter: false,
      type: 'numericColumn',
    },
    {
      field: 'receiving_quantity',
      headerName: $localize`Day Received`,
      minWidth: 130,
      sortable: false,
      filter: false,
      floatingFilter: false,
      type: 'numericColumn',
    },
    {
      field: 'created_at',
      headerName: $localize`Date`,
      minWidth: 160,
      sortable: false,
      filter: false,
      floatingFilter: false,
      dataType: GridTableColumnDataType.Date,
      valueFormatter: ({ value }: any) =>
        value ? this.dateFormatter.formatDate(value, true, false, false, false, false) : '',
    },
    {
      colId: 'received_by_name',
      headerName: $localize`Received By`,
      minWidth: 130,
      sortable: false,
      filter: false,
      floatingFilter: false,
      valueGetter: (p: any) => p.data?.receivedBy?.name ?? '',
    },
    {
      field: 'remark',
      headerName: $localize`Remark`,
      minWidth: 130,
      sortable: false,
      filter: false,
      floatingFilter: false,
    },
  ];

  logDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'MaterialReceiptLogs',
    staticData: true,
    data: [],
  };

  logToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`MRR Log`,
    showNewButton: false,
    showSearch: false,
    showRowCount: true,
    showDownload: false,
  };

  logDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(62vh - 90px)',
    fillEmptyRows: false,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
    private socketService: SocketService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadMrrOptions();
  }

  private loadMrrOptions(): void {
    this.commonService
      .get<any>(`MaterialReceipts?$filter=source eq 'LOCAL' and status eq 'PARTIAL'&$orderby=custom_id desc&$select=id,custom_id`)
      .subscribe({
        next: (res: any) => {
          this.mrrOptions = (res.value ?? []).map((m: any) => ({ id: m.id, label: m.custom_id }));
        },
      });
  }

  reset(): void {
    this.reminder = {
      mrr_id: null,
      message: '',
      purchase_message: '',
      reminder_date: moment().format('DD-MM-YYYY'),
      is_read: false,
    };
    this.mrrTitle = '';
    this.logDataSource = { ...this.logDataSource, data: [] };
  }

  populate(data: any): void {
    this.reminder = {
      mrr_id: data.mrr_id ?? null,
      message: data.message ?? '',
      purchase_message: data.purchase_message ?? '',
      reminder_date: data.reminder_date ? moment(data.reminder_date).format('DD-MM-YYYY') : '',
      is_read: data.is_read ?? false,
    };
    this.mrrTitle = data.mrr?.custom_id ?? '';
    this.loadLog();
  }

  onMrrChange(event: any): void {
    const selectedId = Number(event.detail.item?.id);
    this.reminder.mrr_id = selectedId;
    this.mrrTitle = event.detail.item?.text ?? '';
    this.loadLog();
  }

  private loadLog(): void {
    if (!this.reminder.mrr_id) {
      this.logDataSource = { ...this.logDataSource, data: [] };
      return;
    }
    this.commonService
      .get<any>(
        `MaterialReceiptLogs?$filter=material_receipt_id eq ${this.reminder.mrr_id}&$expand=product,receivedBy&$orderby=created_at desc`,
      )
      .subscribe({
        next: (res: any) => {
          this.logDataSource = { ...this.logDataSource, data: res.value ?? [] };
        },
      });
  }

  private isValid(): boolean {
    return !!(this.reminder.mrr_id && this.reminder.message && this.reminder.reminder_date);
  }

  save(): void {
    if (!this.isValid()) {
      this.toastService.show('error');
      return;
    }

    this.loading = true;
    const payload: Record<string, unknown> = {
      mrr_id: this.reminder.mrr_id,
      message: this.reminder.message,
      purchase_message: this.reminder.purchase_message,
      reminder_date: moment(this.reminder.reminder_date, 'DD-MM-YYYY').format('YYYY-MM-DD'),
    };
    if (this.saveMode === 'PUT') {
      payload['is_read'] = this.reminder.is_read;
    }

    const request$ =
      this.saveMode === 'POST'
        ? this.commonService.post<any>('store/reminders', payload, false)
        : this.commonService.put(`store/reminders/${this.selectedData.id}`, payload, false);

    request$.subscribe({
      next: (res: any) => {
        this.loading = false;
        this.toastService.show(this.saveMode === 'POST' ? 'add' : 'edit');
        if (this.saveMode === 'POST') {
          this.triggerReminderNotification('store-reminder:created', res?.data?.id);
        } else if (this.context === 'purchase' && this.reminder.is_read) {
          this.triggerReminderNotification('store-reminder:read', this.selectedData?.id);
        }
        this.CloseDialog();
        this.saveEvent.emit();
      },
      error: () => {
        this.loading = false;
        this.toastService.show('error');
      },
    });
  }

  private triggerReminderNotification(event: string, reminderId?: number): void {
    if (!reminderId) return;
    const authUser = this.authService.user();
    this.socketService.emit(event, {
      model_id: reminderId,
      model_custom_id: this.mrrTitle || reminderId,
      sender_id: authUser.id,
      sender_name: authUser.name,
    });
  }

  CloseDialog(): void {
    this.open = false;
    this.loading = false;
  }
}
