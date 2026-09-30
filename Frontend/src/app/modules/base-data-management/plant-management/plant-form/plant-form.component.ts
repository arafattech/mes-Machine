import {
  Component,
  EventEmitter,
  Input,
  Output,
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
        error: (error: any) => {
          this.open = false;
          this.CloseDialog();
          this.toastService.show("error");
        },
      });
    }
  }

  checkValidation(event: any) {
    const value = event.target.value;
    if (!value.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
    } else {
      this.valueStateOptions.name = ValueState.None;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.plant.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.plant = new Plant().deserialize({});
  }
}
