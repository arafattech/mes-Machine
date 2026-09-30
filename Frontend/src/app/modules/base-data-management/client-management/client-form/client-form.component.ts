import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@shared/enums/saveMode';
import { Client } from '@shared/model/client';
import { ClientArea } from '@shared/model/clientArea';
import { ClientNote } from '@shared/model/clientNote';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';

@Component({
  selector: 'app-client-form',
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.scss',
})
export class ClientFormComponent {
  @Input() saveMode = 'POST';
  @Input() client: Client = new Client();
  @Output() ClientAdded = new EventEmitter<Client>();
  @Output() RefreshTable = new EventEmitter<any>();
  SelectedNote: ClientNote = new ClientNote();
  SelectedArea: ClientArea = new ClientArea();
  ClientNote: ClientNote[] = [];
  ClientArea: ClientArea[] = [];
  open: boolean = false;
  loading: boolean = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  SelectedAreaList: any | undefined;
  clientAreaName: string = '';
  SelectedNoteList: any | undefined;
  clientNoteName: string = '';
  odata: boolean;
  api: boolean;
  valueStateOptions = {
    name: ValueState.None,
    email: ValueState.None,
    address: ValueState.None,
    bill_to: ValueState.None,
    ship_to: ValueState.None,
  };
  selectedTab = "coreData";
  showAddMore: boolean = false;
  className: string = 'hidden';
  buttonText: string = this.localization.addMore;
  buttonIcon: string = 'add';
  sameAsBillTo: boolean = false;

  constructor(
    private commonService: CommonService,
    private toastService: ToastService
  ) {
    this.odata = commonService.odata;
    this.api = commonService.api;
  }

  ngOnInit() {
    this.LoadClientNote();
    this.LoadClientArea();
  }

  initializeAddMoreState(data?: any) {
    if (this.saveMode === saveMode.PUT) {
      if (data.second_contact_person_name || data.second_contact_person_phone) {
        this.showAddMore = true;
        this.className = '';
        this.buttonText = this.localization.showLess;
        this.buttonIcon = 'slim-arrow-down';
      } else {
        this.showAddMore = false;
        this.className = 'hidden';
        this.buttonText = this.localization.addMore;
        this.buttonIcon = 'add';
      }
    } else {
      this.resetAddMore();
    }
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : '';

    switch (field) {
      case 'name':
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.client.name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;

      case 'email':
        if (!value.trim()) {
          this.valueStateOptions.email = ValueState.Negative;
        } else {
          this.client.email = value;
          this.valueStateOptions.email = ValueState.None;
        }
        break;

      case 'address':
        if (!value.trim()) {
          this.valueStateOptions.address = ValueState.Negative;
        } else {
          this.client.address = value;
          this.valueStateOptions.address = ValueState.None;
        }
        break;

      case 'bill_to':
        if (!value.trim()) {
          this.valueStateOptions.bill_to = ValueState.Negative;
        } else {
          this.client.bill_to = value;
          this.valueStateOptions.bill_to = ValueState.None;
        }
        break;

      case 'ship_to':
        if (!value.trim()) {
          this.valueStateOptions.ship_to = ValueState.Negative;
        } else {
          this.client.ship_to = value;
          this.valueStateOptions.ship_to = ValueState.None;
        }
        break;

      default:
        break;
    }
  }
  coreDataValid() {
    let isValid = true;
    if (this.client.name?.trim()) {
      this.valueStateOptions.name = ValueState.None;
    } else {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    if (this.client.email?.trim()) {
      this.valueStateOptions.email = ValueState.None;
    } else {
      this.valueStateOptions.email = ValueState.Negative;
      isValid = false;
    }
    
    return isValid;
  }
  addressvalidation() {
    let isValid = true;
    if (this.client.address?.trim()) {
      this.valueStateOptions.address = ValueState.None;
    } else {
      this.valueStateOptions.address = ValueState.Negative;
      isValid = false;
    }
    if (this.client.bill_to?.trim()) {
      this.valueStateOptions.bill_to = ValueState.None;
    } else {
      this.valueStateOptions.bill_to = ValueState.Negative;
      isValid = false;
    }
    if (this.client.ship_to?.trim()) {
      this.valueStateOptions.ship_to = ValueState.None;
    } else {
      this.valueStateOptions.ship_to = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }
  
  LoadClientNote() {
    this.commonService.get('ClientNotes?$orderby=id desc&$filter=is_active eq true', this.odata).subscribe({
      next: (response: any) => {
        this.SelectedNoteList = response.value;
      },
      error: (err) => {
        console.error('Client Notes Error', err);
      },
    });
  }

  LoadClientArea() {
    this.commonService.get('ClientAreas?$orderby=id desc&$filter=is_active eq true', this.odata).subscribe({
      next: (response: any) => {
        this.SelectedAreaList = response.value;
      },
      error: (err) => {
        console.error('Client Areas Error', err);
      },
    });
  }

  getNote(items: any) {
    this.SelectedNote = new ClientNote().deserialize({
      id: items.detail.item.id,
      name: items.detail.item.text,
    });
    this.clientNoteName = this.SelectedNote.name;
  }

  getArea(items: any) {
    this.SelectedArea = new ClientArea().deserialize({
      id: items.detail.item.id,
      name: items.detail.item.text,
    });
    this.clientAreaName = this.SelectedArea.name;
  }

  saveClientInfo() {
    if (!this.coreDataValid()) {
      this.selectedTab = "coreData";
      return;
    }
    if (!this.addressvalidation()) {
      this.selectedTab = "personalData";
      return;
    }
    this.loading = true;
    let url = '';
    let request$;
    if (this.saveMode === saveMode.POST) {
      url = 'Clients';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.client.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Clients(${this.client.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.client.toOdata(), true);
    }
    if (request$) {
      request$.subscribe({
        next: (res) => {
          const newClient = new Client().deserialize(res);
          this.ClientAdded.emit(newClient);
          if (this.SelectedArea.id || this.SelectedNote.id) {
            this.ClientAssociate(this.client.id);
          }
          this.CloseDialog();
          this.RefreshTable.emit();
          this.toastService.show(this.ToastType);
        },
        error: (error: any) => {
          this.CloseDialog();
          this.selectedTab = "coreData";
          this.toastService.show('error');
        },
      });
    }
  }
  onTabSelect(event: any) {
    this.selectedTab = event.detail.tab.id;
  }
  ClientAssociate(id: number | undefined) {
    if (!id) {
      return;
    }
    const clientArea = this.SelectedArea.id
      ? [{ id: this.SelectedArea.id }]
      : [];
    const clientNote = this.SelectedNote.id
      ? [{ id: this.SelectedNote.id }]
      : [];

    const data = {
      client_id: id,
      clientarea: clientArea,
      clientnote: clientNote,
    };

    this.commonService.post('client/associate', data, this.api).subscribe({
      next: (response: any) => {
        this.SelectedArea = new ClientArea().deserialize({});
        this.SelectedNote = new ClientNote().deserialize({});
        this.CloseDialog();
      },
      error: (err: any) => {
        console.error('Error associating client:', err);
        this.CloseDialog();
      },
    });
  }
  addMore(): boolean {
    this.showAddMore = !this.showAddMore;
    this.className = this.showAddMore ? '' : 'hidden';
    this.buttonText = this.showAddMore
      ? this.localization.showLess
      : this.localization.addMore;
    this.buttonIcon = this.showAddMore ? 'slim-arrow-down' : 'add';
    if (!this.showAddMore) {
      this.client.second_contact_person_name = '';
      this.client.second_contact_person_phone = '';
    }
    return this.showAddMore;
  }

  resetAddMore() {
    this.className = 'hidden';
    this.showAddMore = false;
    this.buttonText = this.localization.addMore;
    this.buttonIcon = 'add';
    this.client.second_contact_person_name = '';
    this.client.second_contact_person_phone = '';
  }

  onBillToInput() {
    if (this.sameAsBillTo) {
      this.client.ship_to = this.client.bill_to;
    }
    if (!this.client.bill_to || this.client.bill_to.trim() === '') {
      this.sameAsBillTo = false;
    }
  }

  onSameAsBillToChanged() {
    if (this.sameAsBillTo) {
      this.client.ship_to = this.client.bill_to;
    } else {
      this.client.ship_to = '';
    }
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.selectedTab = 'coreData';
    this.client.deserialize({});
    this.clientNoteName = '';
    this.clientAreaName = '';
    this.resetAddMore();
    this.sameAsBillTo = false;
    this.valueStateOptions = {
    name: ValueState.None,
    email: ValueState.None,
    address: ValueState.None,
    bill_to: ValueState.None,
    ship_to: ValueState.None,
  };
  }
}
