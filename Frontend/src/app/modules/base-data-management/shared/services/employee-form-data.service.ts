import { inject, Injectable } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { Department } from '@app/shared/model/department';
import { Employee } from '@app/shared/model/employee';
import { Designation } from '@app/modules/hr-management/shared/models/designation';
import { EmployeeType } from '@app/modules/hr-management/shared/models/employeeType';
import { EmployeeSection } from '@app/modules/hr-management/shared/models/employeeSection';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import { map, Observable, shareReplay } from 'rxjs';

interface ODataResponse<T> {
  value: T[];
}

interface BatchSubResponse<T> {
  id: string;
  status: number;
  body?: ODataResponse<T>;
}

interface BatchResponse {
  responses: BatchSubResponse<unknown>[];
}

interface EmployeeFormReferenceData {
  employeeShifts: EmployeeShift[];
  employees: Employee[];
  departments: Department[];
  employeeTypes: EmployeeType[];
  designations: Designation[];
  employeeSections: EmployeeSection[];
}

const enum BatchId {
  Shifts = 'shifts',
  Employees = 'employees',
  Departments = 'departments',
  EmployeeTypes = 'employeeTypes',
  Designations = 'designations',
  EmployeeSections = 'employeeSections',
}

/**
* Shared cache for the reference data the employee form needs on load
* (shifts, employees, departments, types, designations, sections).
*
* All six lists are fetched in ONE OData JSON `$batch` request, then replayed
* to every subscriber via `shareReplay` — so the form costs a single network
* round-trip and never re-hits the API on reopen. Call `refresh()` after a
* reference entity is created/edited to invalidate.
*/
@Injectable({ providedIn: 'root' })
export class EmployeeFormDataService {
  private readonly commonService = inject(CommonService);

  private referenceData$?: Observable<EmployeeFormReferenceData>;

  getEmployeeShifts(): Observable<EmployeeShift[]> {
    return this.loadReferenceData().pipe(map((data) => data.employeeShifts));
  }

  getEmployees(): Observable<Employee[]> {
    return this.loadReferenceData().pipe(map((data) => data.employees));
  }

  getDepartments(): Observable<Department[]> {
    return this.loadReferenceData().pipe(map((data) => data.departments));
  }

  getEmployeeTypes(): Observable<EmployeeType[]> {
    return this.loadReferenceData().pipe(map((data) => data.employeeTypes));
  }

  getDesignations(): Observable<Designation[]> {
    return this.loadReferenceData().pipe(map((data) => data.designations));
  }

  getEmployeeSections(): Observable<EmployeeSection[]> {
    return this.loadReferenceData().pipe(map((data) => data.employeeSections));
  }

  /** Warm the cache up front (e.g. on form init). Safe to call repeatedly. */
  preload(): void {
    this.loadReferenceData().subscribe();
  }

  /** Drop the cache; next access re-fetches the batch from the API. */
  refresh(): void {
    this.referenceData$ = undefined;
  }

  private loadReferenceData(): Observable<EmployeeFormReferenceData> {
    return (this.referenceData$ ??= this.commonService
      .post<BatchResponse>('$batch', {
        requests: [
          {
            id: BatchId.Shifts,
            method: 'GET',
            url: '/odata/EmployeeShifts?$filter=is_active eq true',
          },
          {
            id: BatchId.Employees,
            method: 'GET',
            url: '/odata/Employees?$top=10000&$orderby=id desc&$filter=is_active eq true',
          },
          {
            id: BatchId.Departments,
            method: 'GET',
            url: '/odata/Departments?$filter=is_active eq true',
          },
          {
            id: BatchId.EmployeeTypes,
            method: 'GET',
            url: '/odata/EmployeeTypes?$filter=is_active eq true',
          },
          {
            id: BatchId.Designations,
            method: 'GET',
            url: '/odata/Designations?$filter=is_active eq true',
          },
          {
            id: BatchId.EmployeeSections,
            method: 'GET',
            url: '/odata/EmployeeSections?$filter=is_active eq true',
          },
        ],
      })
      .pipe(
        map((res) => ({
          employeeShifts: this.extract<EmployeeShift>(res, BatchId.Shifts).map(
            (item) => new EmployeeShift().deserialize(item),
          ),
          employees: this.extract<Employee>(res, BatchId.Employees),
          departments: this.extract<Department>(res, BatchId.Departments),
          employeeTypes: this.extract<EmployeeType>(res, BatchId.EmployeeTypes),
          designations: this.extract<Designation>(res, BatchId.Designations),
          employeeSections: this.extract<EmployeeSection>(
            res,
            BatchId.EmployeeSections,
          ),
        })),
        shareReplay({ bufferSize: 1, refCount: false }),
      ));
  }

  private extract<T>(res: BatchResponse, id: BatchId): T[] {
    const sub = res.responses?.find((r) => r.id === id);
    return (sub?.body as ODataResponse<T> | undefined)?.value ?? [];
  }
}
