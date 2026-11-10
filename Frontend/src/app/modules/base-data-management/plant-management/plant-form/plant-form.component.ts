import { HttpErrorResponse } from "@angular/common/http";
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { Plant } from "@shared/model/plant";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import ValueState from "@ui5/webcomponents-base/dist/types/ValueState.js";
import { ToastService } from "@app/services/toast-service/toast.service";

@Component({
  selector: "app-plant-form",
  templateUrl: "./plant-form.component.html",
  styleUrl: "./plant-form.component.scss",
})
export class PlantFormComponent {
  @ViewChild('nameInput', { read: ElementRef }) nameInput?: ElementRef<HTMLElement>;

  @Input() saveMode = "POST";
  @Input() plant: Plant = new Plant().deserialize({});
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() RefreshTable = new EventEmitter<any>();
  open: boolean = false;
  loading: boolean = false;
  ToastType: "add" | "edit" | "error" = "add";
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  readonly nameMaxLength = 255;
  serverError = "";
  valueStateOptions = {
    name: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService
  ) {}

  onSaveType() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = "";
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = "Plants";
      this.ToastType = "add";
      request$ = this.commonService.post(url, this.plant.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Plants(${this.plant.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, this.plant.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          this.CloseDialog();
          this.RefreshTable.emit();
          this.toastService.show(this.ToastType);
        },
        error: (error: HttpErrorResponse) => {
          this.loading = false;
          this.serverError =
            error.error?.error?.message ??
            error.error?.message ??
            $localize`Something went wrong`;
          this.valueStateOptions.name = ValueState.Negative;
          this.focusNameInput();
        },
      });
    }
  }

  private focusNameInput(): void {
    setTimeout(() => this.nameInput?.nativeElement.focus());
  }

  get nameErrorMessage(): string {
    return this.serverError || this.validationMessage;
  }

  checkValidation(event: any) {
    const value: string = event.target.value;
    this.serverError = "";
    if (!value.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
    } else {
      this.valueStateOptions.name = ValueState.None;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    this.serverError = "";
    if (!this.plant.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      this.focusNameInput();
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.serverError = "";
    this.valueStateOptions.name = ValueState.None;
    this.plant = new Plant().deserialize({});
  }
}
