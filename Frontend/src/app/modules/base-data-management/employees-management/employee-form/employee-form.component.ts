import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { CommonService } from "@app/services/common-service/common.service";
import { MediaService } from "@app/services/media-service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { Asset } from "@app/shared/model/asset";
import { Department } from "@app/shared/model/department";
import { EmployeeSalary } from "@app/modules/hr-management/shared/models/EmployeeSalary";
import { environment } from "@env/environment";
import { AssosiateComponent } from "@shared/components/assosiate/assosiate.component";
import { AttachmentUploadComponent } from "@shared/components/attachment-upload/attachment-upload.component";
import { BloodGroups } from "@shared/enums/bloodGroups";
import { Designation } from "@app/modules/hr-management/shared/models/designation";
import { EmployeeType } from "@app/modules/hr-management/shared/models/employeeType";
import { Gender } from "@shared/enums/gender";
import { Religion } from "@shared/enums/religion";
import { saveMode } from "@shared/enums/saveMode";
import { Employee } from "@shared/model/employee";
import { EmployeeHasAsset } from "@app/modules/hr-management/shared/models/employeeHasAsset";
import { EmployeeBank } from "@shared/model/employeeBank";
import { Localization } from "@shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import moment from "moment";
import { concat, forkJoin } from "rxjs";
import { toArray } from "rxjs/operators";
import { Permissions } from "@app/shared/enums/permissions";
import { EmployeeSection } from "@app/modules/hr-management/shared/models/employeeSection";
import { EmployeeFormDataService } from "@base-data-module/shared/services/employee-form-data.service";

@Component({
  selector: "app-employee-form",
  templateUrl: "./employee-form.component.html",
  styleUrl: "./employee-form.component.scss",
})
export class EmployeeFormComponent implements OnInit {
  @ViewChild("itemAttachmentsTab")
  itemAttachmentsTab!: AttachmentUploadComponent;
  @ViewChild("employeeAssetTableEdit")
  employeeAssetTableEdit!: AgGridTableComponent;
  @ViewChild("employeeBankTableEdit")
  employeeBankTableEdit!: AgGridTableComponent;
  @ViewChild("employeeBankTablePost")
  employeeBankTablePost?: AgGridTableComponent;
  @ViewChild("employeeAssetTablePost")
  employeeAssetTablePost?: AgGridTableComponent;
  @ViewChild("assetsAssociate") assetsAssociateRef!: AssosiateComponent;

  @Input() saveMode = "POST";
  @Input() employee: Employee = new Employee();
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() isOpenAssetAssociate: EventEmitter<void> = new EventEmitter<void>();
  @Output() RefreshTable = new EventEmitter<any>();
  @Output() RefreshAssetTable = new EventEmitter<any>();
  @Output() RefreshBankTable = new EventEmitter<any>();
  @Output() isPlantAssosiate = new EventEmitter<void>();
  @Output() SelectedAssets = new EventEmitter<any>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();
  employeeHasAsset = EmployeeHasAsset;
  employeeHasAssets = new EmployeeHasAsset();
  employeeHasAssetsList: EmployeeHasAsset[] = [];
  private editingLocalAsset: EmployeeHasAsset | null = null;
  employeeBankInfo = EmployeeBank;
  EmployeeBank = new EmployeeBank().deserialize({});
  employeeBankInfoList: EmployeeBank[] = [];
  isAssetOpen: boolean = false;
  isBankOpen: boolean = false;
  odata: boolean;
  api: boolean;
  open: boolean = false;
  loading: boolean = false;
  ToastType: "add" | "edit" | "error" = "add";
  public validationMessage = Localization.requiredField;
  public validationContactMessage = "";
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  employeeTypeName = "";
  designationName = "";
  employeeSectionName = "";
  employeeTypes: EmployeeType[] = [];
  employeeSections: EmployeeSection[] = [];
  designations: Designation[] = [];
  religions = Object.values(Religion);
  bloodGroups = Object.values(BloodGroups);
  genders = Object.values(Gender);
  sameAsPresentAddress: boolean = false;
  isCheckboxEnabled: boolean = false;
  message_strip: boolean = false;
  duplicate_email: string = "";
  bankWarningStrip: boolean = false;
  assetWarningStrip: boolean = false;
  resEmployeeId: number | null = null;
  valueStateOptions = {
    first_name: ValueState.None,
    employee_no: ValueState.None,
    contact_number: ValueState.None,
    email: ValueState.None,
    employee_type: ValueState.None,
    employee_type_id: ValueState.None,
    employee_section_id: ValueState.None,
    emeergency_number: ValueState.None,
    emgerency_contact_relation: ValueState.None,
    emgerency_contact_person_name: ValueState.None,
    blood_group: ValueState.None,
    present_address: ValueState.None,
    genders: ValueState.None,
    religions: ValueState.None,
    selectAssets: ValueState.None,
    bankName: ValueState.None,
  };
  selectedTab = "coreData";
  public permissions = Permissions;
  AllRoles: any;
  EmployeeImage: string | null = null;
  employeeImageLoaded = false;
  leaveTypes: any[] = [];
  leaveQuota: { [key: number]: number } = {};
  totalYearlyLeave: number = 0;
  manualTotalEdit: boolean = false;
  selectedLeaveTypes: any;
  leaveTypeList: any;
  salaryTypes: any[] = [];
  salaryAmounts: { [key: number]: number } = {};
  netSalary: number = 0;
  assets: Asset[] = [];
  assetTitle = "";
  departmentName = "";
  EmployeeName: string = "";
  EmployeeSalary = new EmployeeSalary().deserialize({});
  departments: Department[] = [];
  isServerSideRequest: boolean = false;
  assetSaveMode: saveMode = saveMode.POST;
  bankSaveMode: saveMode = saveMode.POST;
  bankEditIndex: number = -1;
  employeeIdExists: boolean = false;
  currentDate = moment().format("DD-MM-YYYY");
  moment = moment;
  EmployeeStatus: any;
  leaveList: { name: string; total: number }[] = [];
  totalLeaves: number = 0;
  public isBankLoading: boolean = false;

  bankColumns: AgGridTableColumn<any>[] = [];
  assetColumns: AgGridTableColumn<any>[] = [];

  bankStaticDataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };

  assetStaticDataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };

  bankToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: "",
    showNewButton: false,
    addButtonText: "",
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
  };

  assetToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: "",
    showNewButton: false,
    addButtonText: "",
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
  };

  bankDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(54vh - 70px)",
    fillEmptyRows: true,
  };

  assetDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(54vh - 70px)",
    fillEmptyRows: true,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private mediaService: MediaService,
    private cdr: ChangeDetectorRef,
    public rolePermissionService: RolePermissionService,
    private employeeFormDataService: EmployeeFormDataService,
    private destroyRef: DestroyRef,
  ) {
    this.odata = this.commonService.odata;
    this.api = commonService.api;
    this.bankColumns = this.buildBankColumns();
    this.assetColumns = this.buildAssetColumns();
    this.bankToolbarConfig = {
      headerTitle: `${$localize`Bank`} ${$localize`Info`}`,
      showNewButton: this.rolePermissionService.hasPermission(Permissions.HR_EMPLOYEE_EDIT),
      addButtonText: $localize`New`,
      showSearch: false,
      showRowCount: false,
      showSegmentButton: false,
    };
    this.assetToolbarConfig = {
      headerTitle: `${$localize`Assets`} ${$localize`List`}`,
      showNewButton: this.rolePermissionService.hasPermission(Permissions.HR_EMPLOYEE_ASSET_CREATE),
      addButtonText: $localize`New`,
      showSearch: false,
      showRowCount: false,
      showSegmentButton: false,
    };
  }

  ngOnInit() {
    this.getAssets();
    this.initDepartment();
    this.initEmployeeType();
    this.initDesignation();
    this.initEmployeeSection();
  }

  initEmployeeType() {
    this.employeeFormDataService
      .getEmployeeTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((employeeTypes) => {
        this.employeeTypes = employeeTypes;
      });
  }

  getEmployeeTypes(items: any) {
    const selectedItem = items.detail.item;
    if (selectedItem) {
      this.employee.employee_type_id = Number(selectedItem.id);
      this.employeeTypeName = selectedItem.text;
    }
  }

  getDesignations(items: any) {
    const selectedItem = items.detail.item;
    if (selectedItem) {
      this.employee.designation_id = Number(selectedItem.id);
      this.designationName = selectedItem.text;
    }
  }

  initDesignation() {
    this.employeeFormDataService
      .getDesignations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((designations) => {
        this.designations = designations;
      });
  }

  getEmployeeSections(items: any) {
    const selectedItem = items.detail.item;
    if (selectedItem) {
      this.employee.employee_section_id = Number(selectedItem.id);
      this.employeeSectionName = selectedItem.text;
    }
  }

  initEmployeeSection() {
    this.employeeFormDataService
      .getEmployeeSections()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((employeeSections) => {
        this.employeeSections = employeeSections;
      });
  }

  getDepartment(items: any) {
    const selectedItem = items.detail.item;
    if (selectedItem) {
      this.employee.department_id = Number(selectedItem.id);
      this.departmentName = selectedItem.text;
    }
  }

  initDepartment() {
    this.employeeFormDataService
      .getDepartments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((departments) => {
        this.departments = departments;
      });
  }

  onSalaryChange() {
    let totalSalary = this.EmployeeSalary.total_salary;
    this.EmployeeSalary.basic = totalSalary * 0.5;
    this.EmployeeSalary.house_rent = totalSalary * 0.3;
    this.EmployeeSalary.medical_allowance = 750;
    this.EmployeeSalary.transport_allowance = 400;
    this.EmployeeSalary.other_allowance =
      totalSalary -
      this.EmployeeSalary.basic -
      this.EmployeeSalary.house_rent -
      this.EmployeeSalary.medical_allowance -
      this.EmployeeSalary.transport_allowance;
  }

  private hasSalaryData(salary: EmployeeSalary): boolean {
    return [
      salary.total_salary,
      salary.basic,
      salary.house_rent,
      salary.medical_allowance,
      salary.transport_allowance,
      salary.other_allowance,
    ].some((value) => Number(value) > 0);
  }

  onSalarySave(employeeId: number) {
    const salaryPayload = new EmployeeSalary().deserialize(this.EmployeeSalary);
    salaryPayload.employee_id = Number(employeeId);

    if (this.saveMode === saveMode.PUT) {
      if (this.employee.salary) {
        this.commonService
          .put(
            `EmployeeSalaries/${salaryPayload.id}`,
            salaryPayload.toOdata(),
          )
          .subscribe({
            next: (res: any) => {
              this.CloseDialog();
              this.RefreshTable.emit();
              this.toastService.show(this.ToastType);
            },
            error: (err: any) => {
              console.error(err);
            },
          });
      } else {
        this.commonService
          .post("EmployeeSalaries", salaryPayload)
          .subscribe({
            next: (res: any) => {
              this.CloseDialog();
              this.RefreshTable.emit();
              this.toastService.show(this.ToastType);
            },
            error: (err: any) => {
              console.error(err);
            },
          });
      }
    } else if (this.saveMode === saveMode.POST) {
      this.commonService
        .post("EmployeeSalaries", salaryPayload)
        .subscribe({
          next: (res: any) => {
            this.CloseDialog();
            this.RefreshTable.emit();
            this.toastService.show(this.ToastType);
          },
          error: (err: any) => {
            console.error(err);
          },
        });
    }
  }

  getEmployeeImageData() {
    this.commonService
      .get(`Employees/${this.employee.id}?$expand=media`)
      .subscribe({
        next: (res: any) => {
          const standardMedia = (res.media ?? []).find(
            (item: any) => item.is_standard === true,
          );
          const id = standardMedia ? standardMedia.id : null;
          const fileName = standardMedia ? standardMedia.file_name : null;
          const resolvedImage =
            id && fileName
              ? `${environment.ServerApi}/storage/${id}/${fileName}`
              : null;

          // Same URL as last time (e.g. reopening the same employee) — the
          // [lazyLoad] input won't change, so the directive never re-fires
          // onStateChange. Only reset the blur when the image actually changes.
          if (resolvedImage !== this.EmployeeImage) {
            this.employeeImageLoaded = false;
          }
          this.EmployeeImage = resolvedImage;

          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error("Error to fetch data", err);
        },
      });
  }

  onEmployeeImageStateChange(event: { reason: string }): void {
    if (event.reason === "loading-succeeded") {
      this.employeeImageLoaded = true;
    }
  }

  employeeLabelFn = (item: any) =>
    `${item.employee_no} - ${item.first_name}${item.last_name ? ' ' + item.last_name : ''}`;

  /** Looks up and displays a supervisor's name in edit mode — server-dropdown searches
   * on demand rather than keeping a preloaded employee list to search locally. */
  resolveSupervisorName(supervisorId: number | null | undefined): void {
    this.EmployeeName = "";
    if (!supervisorId) return;

    this.commonService.get(`Employees(${supervisorId})`, this.odata).subscribe({
      next: (item: any) => {
        this.EmployeeName = item ? this.employeeLabelFn(item) : "";
      },
      error: (err) => console.error("Supervisor fetch error", err),
    });
  }

  setSupervisor(item: any) {
    if (!item) return;

    this.employee.supervisor_id = Number(item.id);
    this.EmployeeName = this.employeeLabelFn(item);
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "employee_id":
        if (!value.trim()) {
          this.valueStateOptions.employee_no = ValueState.Negative;
        } else {
          this.employee.employee_no = value;

          if (this.saveMode === saveMode.POST) {
            this.checkEmployeeIdExists(event.target.value);
          } else {
            this.valueStateOptions.employee_no = ValueState.None;
          }
        }
        break;

      case "first_name":
        if (!value.trim()) {
          this.valueStateOptions.first_name = ValueState.Negative;
        } else {
          this.employee.first_name = value;
          this.valueStateOptions.first_name = ValueState.None;
        }
        break;

      case "employee_type":
        if (!value.trim()) {
          this.valueStateOptions.employee_type = ValueState.Negative;
        } else {
          this.employee.employee_type = value;
          this.valueStateOptions.employee_type = ValueState.None;
        }
        break;

      case "contact_number":
        if (!value.trim()) {
          this.valueStateOptions.contact_number = ValueState.Negative;
          this.validationContactMessage = this.localization.requiredField;
        } else if (value.length !== 11) {
          this.valueStateOptions.contact_number = ValueState.Negative;
          this.validationContactMessage = $localize`Contact number must be exactly 11 digits.`;
        } else {
          this.employee.contact_number = value;
          this.valueStateOptions.contact_number = ValueState.None;
          this.validationContactMessage = this.localization.requiredField;
        }
        break;

      case "blood_group":
        if (!value.trim()) {
          this.valueStateOptions.blood_group = ValueState.Negative;
        } else {
          this.employee.blood_group = value;
          this.valueStateOptions.blood_group = ValueState.None;
        }
        break;

      case "emgerency_contact_relation":
        if (!value.trim()) {
          this.valueStateOptions.emgerency_contact_relation =
            ValueState.Negative;
        } else {
          this.employee.emgerency_contact_relation = value;
          this.valueStateOptions.emgerency_contact_relation = ValueState.None;
        }
        break;

      case "emgerency_contact_person_name":
        if (!value.trim()) {
          this.valueStateOptions.emgerency_contact_person_name =
            ValueState.Negative;
        } else {
          this.employee.emgerency_contact_person_name = value;
          this.valueStateOptions.emgerency_contact_person_name =
            ValueState.None;
        }
        break;

      case "present_address":
        if (!value.trim()) {
          this.valueStateOptions.present_address = ValueState.Negative;
        } else {
          this.employee.present_address = value;
          this.valueStateOptions.present_address = ValueState.None;
        }
        break;
      case "genders":
        if (!value.trim()) {
          this.valueStateOptions.genders = ValueState.Negative;
        } else {
          this.employee.gender = value;
          this.valueStateOptions.genders = ValueState.None;
        }
        break;

      case "religions":
        if (!value.trim()) {
          this.valueStateOptions.religions = ValueState.Negative;
        } else {
          this.employee.religion = value;
          this.valueStateOptions.religions = ValueState.None;
        }
        break;
      case "selectAssets":
        this.onAssetChange(event);
        break;
      case "bankName":
        this.EmployeeBank.bank_name = value;
        break;

      default:
        break;
    }
  }

  coreDataValidation(): boolean {
    let isValid = true;

    if (!String(this.employee.employee_no ?? '').trim()) {
      this.valueStateOptions.employee_no = ValueState.Negative;
      isValid = false;
    } else if (this.employeeIdExists) {
      this.valueStateOptions.employee_no = ValueState.Negative;
      isValid = false;
    } else {
      this.valueStateOptions.employee_no = ValueState.None;
    }

    if (!this.employee.first_name?.trim()) {
      this.valueStateOptions.first_name = ValueState.Negative;
      isValid = false;
    } else {
      this.valueStateOptions.first_name = ValueState.None;
    }

    const contact = this.employee.contact_number?.trim() || "";
    if (!contact) {
      this.valueStateOptions.contact_number = ValueState.Negative;
      this.validationContactMessage = this.localization.requiredField;
      isValid = false;
    } else if (contact.length !== 11) {
      this.valueStateOptions.contact_number = ValueState.Negative;
      this.validationContactMessage = $localize`Contact number must be exactly 11 digits.`;
      isValid = false;
    } else {
      this.valueStateOptions.contact_number = ValueState.None;
      this.validationContactMessage = this.localization.requiredField;
    }

    return isValid;
  }

  personalDataValidation(): boolean {
    let isValid = true;

    if (!this.employee.present_address?.trim()) {
      this.valueStateOptions.present_address = ValueState.Negative;
      isValid = false;
    } else {
      this.valueStateOptions.present_address = ValueState.None;
    }

    return isValid;
  }

  generateCode(data?: any) {
    this.commonService.post(`generate-id`, data, this.api).subscribe({
      next: (response: any) => {
        this.employee.employee_no = response.code;
        this.checkValidation({ target: { value: response.code } }, "code");
        this.checkValidation({ target: { value: response.code } }, "code");
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error("Error Generating Item Code:", error);
      },
    });
  }

  checkEmployeeIdExists(employeeNo: string): void {
    if (!employeeNo) return;

    this.commonService
      .get(`Employees?$filter=employee_no eq ${employeeNo}`, true)
      .subscribe({
        next: (response: any) => {
          if (response.value && response.value.length > 0) {
            this.employeeIdExists = true;
            this.valueStateOptions.employee_no = ValueState.Negative;
            this.validationMessage = "Employee ID already exists";
          } else {
            this.employeeIdExists = false;
            this.valueStateOptions.employee_no = ValueState.None;
          }
        },
        error: (err) => {
          console.error("Error checking employee ID", err);
          this.valueStateOptions.employee_no = ValueState.None;
        },
      });
  }

  onTotalLeaveEdit(event: any) {
    this.totalYearlyLeave = Number(event.target.value) || 0;
    this.manualTotalEdit = true;
  }

  associateTableColum() {
    const columns = [
      {
        accessor: "custom_id",
      },
      {
        accessor: "name",
      },
    ];
    return columns;
  }

  getAssets() {
    this.commonService
      .get(`Assets?$filter=is_active eq true`, this.odata)
      .subscribe({
        next: (response: any) => {
          this.assets = response.value.map((item: any) =>
            new Asset().deserialize(item),
          );
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  onAssetChange(event: any) {
    this.employeeHasAssets.asset_id = event.detail.item.id;
    this.assetTitle = event.detail.item?.text;
  }

  private buildBankColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: "is_active",
        headerName: $localize`Active`,
        cellRenderer: AgGridBooleanCellRendererComponent,
        width: 90,
        minWidth: 80,
        filter: false,
        sortable: false,
      },
      {
        field: "is_primary",
        headerName: $localize`Primary`,
        cellRenderer: AgGridBooleanCellRendererComponent,
        width: 90,
        minWidth: 80,
        filter: false,
        sortable: false,
      },
      { field: "bank_name", headerName: $localize`Bank Name`, minWidth: 150 },
      { field: "branch_name", headerName: $localize`Branch Name`, minWidth: 150 },
      { field: "account_number", headerName: $localize`Account Number`, minWidth: 160 },
      { field: "account_holder_name", headerName: $localize`Account Holder Name`, minWidth: 180, flex: 1 },
      { field: "swift_code", headerName: $localize`Swift Code`, minWidth: 130 },
    ];
  }

  private buildAssetColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: "is_active",
        headerName: $localize`Active`,
        cellRenderer: AgGridBooleanCellRendererComponent,
        width: 90,
        minWidth: 80,
        filter: false,
        sortable: false,
      },
      {
        colId: "asset.name",
        headerName: $localize`Asset`,
        minWidth: 150,
        valueGetter: (params: any) => {
          const name = params.data?.asset?.name;
          if (name) return name;
          const found = this.assets.find((a) => a.id === params.data?.asset_id);
          return found?.name ?? "-";
        },
      },
      { field: "remarks", headerName: $localize`Remarks`, minWidth: 150 },
      { field: "note", headerName: $localize`Note`, minWidth: 150 },
      {
        field: "issued_date",
        headerName: $localize`Issue Date`,
        minWidth: 130,
        filter: false,
      },
      {
        field: "return_date",
        headerName: $localize`Return Date`,
        minWidth: 130,
        filter: false,
      },
    ];
  }

  private updateBankGrid(): void {
    const data = [...this.employeeBankInfoList];
    this.bankStaticDataSource = { ...this.bankStaticDataSource, data };
    this.employeeBankTablePost?.setStaticData(data);
  }

  private updateAssetGrid(): void {
    const data = [...this.employeeHasAssetsList];
    this.assetStaticDataSource = { ...this.assetStaticDataSource, data };
    this.employeeAssetTablePost?.setStaticData(data);
  }

  onBankDelete(data: any): void {
    if (this.saveMode === saveMode.POST) {
      this.deleteEmployeeBank(data);
    } else {
      this.IsDelete.emit(`EmployeeBankInfos(${data.id})`);
    }
  }

  onAssetDelete(data: any): void {
    if (this.saveMode === saveMode.POST) {
      this.deleteEmployeeAsset(data);
    } else {
      this.IsDelete.emit(`EmployeeHasAssets/${data.id}`);
    }
  }

  addStaticEmployeeAsset() {
    this.employeeHasAssets = new EmployeeHasAsset().deserialize({});
    this.editingLocalAsset = null;
    this.assetTitle = "";
    this.assetSaveMode = saveMode.POST;
    this.assetWarningStrip = false;
    this.isAssetOpen = true;
  }

  newEmployeeAsset() {
    this.employeeHasAssets = new EmployeeHasAsset().deserialize({});
    this.editingLocalAsset = null;
    this.assetTitle = "";
    this.assetSaveMode = saveMode.POST;
    this.assetWarningStrip = false;
    this.isAssetOpen = true;
  }

  editEmployeeAsset(data: any) {
    this.employeeHasAssets = new EmployeeHasAsset().deserialize(data);
    this.editingLocalAsset = data.id ? null : data;
    this.assetTitle =
      this.assets.find((item) => item.id === data.asset_id)?.name ?? "";
    this.assetSaveMode = data.id ? saveMode.PUT : saveMode.POST;
    this.assetWarningStrip = false;
    this.isAssetOpen = true;
  }

  addStaticEmployeeBank() {
    this.EmployeeBank = new EmployeeBank().deserialize({});
    this.bankSaveMode = saveMode.POST;
    this.bankEditIndex = -1;
    this.bankWarningStrip = false;
    this.isBankOpen = true;
  }

  newEmployeeBank() {
    this.EmployeeBank = new EmployeeBank().deserialize({});
    this.bankSaveMode = saveMode.POST;
    this.bankEditIndex = -1;
    this.bankWarningStrip = false;
    this.isBankOpen = true;
  }

  editEmployeeBank(data: any) {
    if (this.saveMode === saveMode.POST) {
      this.bankEditIndex = this.employeeBankInfoList.findIndex(
        (item) => item === data,
      );
    }
    this.EmployeeBank = new EmployeeBank().deserialize(data);
    this.bankSaveMode = data.id ? saveMode.PUT : saveMode.POST;
    this.bankWarningStrip = false;
    this.isBankOpen = true;
  }

  saveEmployee() {
    if (!this.coreDataValidation()) {
      this.selectedTab = "coreData";
      return;
    }
    if (!this.personalDataValidation()) {
      this.selectedTab = "personalData";
      return;
    }

    if (this.employee.is_supervisor) {
      this.employee.supervisor_id = undefined;
    }

    if (this.employee.email == "" || this.employee.email == null) {
      this.employee.email = undefined;
    }

    this.loading = true;
    let url = "";
    let request$;
    if (this.saveMode === saveMode.POST) {
      url = "Employees";
      this.ToastType = "add";
      request$ = this.commonService.post(url, this.employee.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Employees(${this.employee.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, this.employee.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res: any) => {
          this.resEmployeeId = res.id;
          this.mediaService.setId(res.id);
          if (this.employee.salary || this.hasSalaryData(this.EmployeeSalary)) {
            this.onSalarySave(res.id);
          }
          if (this.employeeHasAssetsList.length) {
            const requests = this.employeeHasAssetsList.map((asset) => {
              asset.employee_id = res.id;
              return this.commonService.post(
                "EmployeeHasAssets",
                asset.toOdata(),
                true,
              );
            });
            // Sequential writes: the server generates custom_id from
            // MAX(custom_id)+1 with no row lock, so concurrent POSTs (forkJoin)
            // read the same max and collide on the unique custom_id — only one
            // row survives. concat runs them in order, so each insert sees the
            // previous one's id.
            concat(...requests)
              .pipe(toArray())
              .subscribe(() => {
                this.employeeHasAssetsList = [];
                this.RefreshTable.emit();
              });
          }
          if (this.employeeBankInfoList.length) {
            const bankRequests = this.employeeBankInfoList.map((bank) => {
              bank.employee_id = res.id;
              return this.commonService.post(
                "EmployeeBankInfos",
                bank.toOdata(),
                true,
              );
            });
            forkJoin(bankRequests).subscribe(() => {
              this.employeeBankInfoList = [];
              this.RefreshTable.emit();
            });
          }
          this.RefreshTable.emit();
          this.CloseDialog();
          this.toastService.show(this.ToastType);
        },
        error: (err: any) => {
          console.error("Employee not saved", err);
          if (err.error.exception === "Exception") {
            this.message_strip = true;
            this.duplicate_email = err.error.message;
            this.selectedTab = "coreData";
          }
          this.loading = false;
          this.toastService.show("error");
        },
      });
    }
  }

  private isAssetFormEmpty(): boolean {
    const a = this.employeeHasAssets;
    return (
      !a.asset_id &&
      !a.issued_date?.trim() &&
      !a.return_date?.trim() &&
      !a.remarks?.trim() &&
      !a.note?.trim()
    );
  }

  private isBankFormEmpty(): boolean {
    const b = this.EmployeeBank;
    return (
      !b.bank_name?.trim() &&
      !b.branch_name?.trim() &&
      !b.account_number?.trim() &&
      !b.account_holder_name?.trim() &&
      !b.swift_code?.trim()
    );
  }

  saveEmployeeHasAsset() {
    if (this.isAssetFormEmpty()) {
      this.assetWarningStrip = true;
      return;
    }
    this.assetWarningStrip = false;

    if (this.assetSaveMode === saveMode.POST) {
      this.handleEmployeeAssetLocal();
    } else if (this.assetSaveMode === saveMode.PUT) {
      this.handleEmployeeAssetAPI();
    }
  }

  saveEmployeeBankInfo() {
    if (this.isBankFormEmpty()) {
      this.bankWarningStrip = true;
      return;
    }
    this.bankWarningStrip = false;

    if (this.bankSaveMode === saveMode.POST) {
      this.handleEmployeeBankLocal();
    } else if (this.bankSaveMode === saveMode.PUT) {
      this.handleEmployeeBankAPI();
    }
  }

  handleEmployeeBankLocal() {
    const bank = new EmployeeBank().deserialize(this.EmployeeBank);
    if (!this.resEmployeeId) {
      if (this.bankEditIndex > -1) {
        this.employeeBankInfoList[this.bankEditIndex] = bank;
      } else {
        this.employeeBankInfoList = [...this.employeeBankInfoList, bank];
      }

      this.updateBankGrid();
      this.EmployeeBank = new EmployeeBank().deserialize({});
      this.bankEditIndex = -1;
      this.isBankOpen = false;
    } else {
      bank.employee_id = this.resEmployeeId;
      this.commonService
        .post("EmployeeBankInfos", bank.toOdata(), true)
        .subscribe({
          next: () => {
            this.employeeBankTableEdit?.refreshGridData(true);
            this.closeEmployeeBank();
            this.toastService.show("add");
          },
          error: () => {
            this.closeEmployeeBank();
            this.toastService.show("error");
          },
        });
    }
  }

  handleEmployeeBankAPI() {
    this.isBankLoading = true;
    this.commonService
      .put(
        `EmployeeBankInfos(${this.EmployeeBank.id})`,
        this.EmployeeBank.toOdata(),
        true,
      )
      .subscribe({
        next: () => {
          this.employeeBankTableEdit?.refreshGridData(true);
          this.closeEmployeeBank();
          this.toastService.show("edit");
        },
        error: () => {
          this.closeEmployeeBank();
          this.toastService.show("error");
        },
      });
  }

  deleteEmployeeBank(bank: any) {
    this.employeeBankInfoList = this.employeeBankInfoList.filter(
      (item) => item !== bank,
    );
    this.updateBankGrid();
  }

  handleEmployeeAssetLocal() {
    const asset = new EmployeeHasAsset().deserialize(this.employeeHasAssets);
    asset.asset_id = Number(asset.asset_id);

    if (!this.resEmployeeId) {
      const index = this.editingLocalAsset
        ? this.employeeHasAssetsList.findIndex((item) => item === this.editingLocalAsset)
        : -1;
      if (index > -1) {
        this.employeeHasAssetsList[index] = asset;
      } else {
        this.employeeHasAssetsList = [...this.employeeHasAssetsList, asset];
      }

      this.updateAssetGrid();
      this.employeeHasAssets = new EmployeeHasAsset().deserialize({});
      this.editingLocalAsset = null;
      this.assetTitle = "";
      this.isAssetOpen = false;
    } else {
      asset.employee_id = this.resEmployeeId;
      this.loading = true;
      this.commonService
        .post("EmployeeHasAssets", asset.toOdata(), true)
        .subscribe({
          next: () => {
            this.RefreshAssetTable.emit();
            this.employeeAssetTableEdit?.refreshGridData(true);
            this.closeEmployeeAsset();
            this.toastService.show("add");
          },
          error: () => {
            this.closeEmployeeAsset();
            this.toastService.show("error");
          },
        });
    }
  }

  handleEmployeeAssetAPI() {
    this.loading = true;
    this.commonService
      .put(
        `EmployeeHasAssets(${this.employeeHasAssets.id})`,
        this.employeeHasAssets.toOdata(),
        true,
      )
      .subscribe({
        next: (_res) => {
          this.RefreshAssetTable.emit();
          this.employeeAssetTableEdit?.refreshGridData(true);
          this.closeEmployeeAsset();
          this.toastService.show("edit");
        },
        error: () => {
          this.closeEmployeeAsset();
          this.toastService.show("error");
        },
      });
  }

  deleteEmployeeAsset(asset: any) {
    this.employeeHasAssetsList = this.employeeHasAssetsList.filter(
      (item) => item !== asset,
    );
    this.updateAssetGrid();
  }

  onPresentAddressChange(event?: any) {
    const hasData = (this.employee?.present_address || "").trim().length > 0;
    this.checkValidation(event, "present_address");
    this.isCheckboxEnabled = hasData;

    if (this.sameAsPresentAddress && hasData) {
      this.employee.permanent_address = this.employee.present_address;
    }

    if (!hasData) {
      this.sameAsPresentAddress = false;
    }
  }

  initEmployeeStatus(employeeId: number | undefined) {
    const startDate = moment(this.employee.created_at).format("DD-MM-YYYY");
    const endDate = moment().format("DD-MM-YYYY");
    this.commonService
      .get(`employePayrollStatus/${employeeId}/${startDate}/${endDate}`, false)
      .subscribe({
        next: (res: any) => {
          this.EmployeeStatus = res;
          this.loading = false;

          this.leaveCount();
        },
        error: (err: any) => {
          console.error("Error fetching employee data:", err);
          this.loading = false;
        },
      });
  }

  leaveCount() {
    if (this.EmployeeStatus?.leaveStatus?.leaveInYear) {
      this.leaveList = this.EmployeeStatus.leaveStatus.leaveInYear.map(
        (leave: any) => ({
          name: leave.leave_type?.name || "Unknown",
          total: leave.total || 0,
        }),
      );

      this.totalLeaves = this.leaveList.reduce(
        (sum, leave) => sum + leave.total,
        0,
      );
    }
  }

  toggleSameAddress() {
    if (this.sameAsPresentAddress) {
      this.employee.permanent_address = this.employee.present_address;
    }
  }

  onTabSelect(event: any) {
    this.selectedTab = event.detail.tab.id;
    if (this.selectedTab == "attachments" && this.saveMode === saveMode.PUT) {
      this.itemAttachmentsTab.isEdit = true;
      this.itemAttachmentsTab.isPreview = true;
      this.itemAttachmentsTab?.loadInputImages();
      return;
    }

    if (this.selectedTab === "bank" && this.saveMode === saveMode.PUT) {
      this.employeeBankTableEdit?.refreshGridData(true);
    }
  }

  onDeleteSuccess() {
    this.RefreshAssetTable.emit();
    this.employeeBankTableEdit?.refreshGridData(true);
    this.employeeAssetTableEdit?.refreshGridData(true);
  }

  closeEmployeeAsset() {
    this.isAssetOpen = false;
    this.loading = false;
    this.editingLocalAsset = null;
    this.assetWarningStrip = false;
  }

  closeEmployeeBank() {
    this.isBankOpen = false;
    this.bankEditIndex = -1;
    this.loading = false;
    this.isBankLoading = false;
    this.bankWarningStrip = false;
  }

  resetAssets() {
    this.employeeHasAssetsList = [];
    this.employeeHasAssets = new EmployeeHasAsset();
    this.assetTitle = "";
    this.updateAssetGrid();
  }

  resetBanks() {
    this.employeeBankInfoList = [];
    this.EmployeeBank = new EmployeeBank();
    this.bankEditIndex = -1;
    this.updateBankGrid();
  }

  SalaryFormReset() {
    this.EmployeeSalary = new EmployeeSalary();
    this.EmployeeSalary.basic = 0;
    this.EmployeeSalary.house_rent = 0;
    this.EmployeeSalary.medical_allowance = 0;
    this.EmployeeSalary.transport_allowance = 0;
    this.EmployeeSalary.other_allowance = 0;
    this.EmployeeSalary.total_salary = 0;
  }

  CloseDialog() {
    this.loading = false;
    this.open = false;
    this.message_strip = false;
    this.resEmployeeId = null;
    this.employee = new Employee().deserialize({});
    this.EmployeeName = "";
    this.departmentName = "";
    this.designationName = "";
    this.employeeTypeName = "";
    this.employeeSectionName = "";
    this.valueStateOptions.contact_number = ValueState.None;
    this.valueStateOptions.employee_no = ValueState.None;
    this.valueStateOptions.first_name = ValueState.None;
    this.valueStateOptions.email = ValueState.None;
    this.valueStateOptions.employee_type = ValueState.None;
    this.valueStateOptions.emeergency_number = ValueState.None;
    this.valueStateOptions.emgerency_contact_person_name = ValueState.None;
    this.valueStateOptions.emgerency_contact_relation = ValueState.None;
    this.valueStateOptions.blood_group = ValueState.None;
    this.valueStateOptions.present_address = ValueState.None;
    this.valueStateOptions.genders = ValueState.None;
    this.valueStateOptions.religions = ValueState.None;
    this.itemAttachmentsTab.fileCount = 0;
    this.resetAssets();
    this.resetBanks();
    this.SalaryFormReset();
  }
}
