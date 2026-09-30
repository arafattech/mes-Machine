import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import moment from 'moment';

import { CommonService } from '@app/services/common-service/common.service';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';

@Injectable({
  providedIn: 'root',
})
export class ShiftResolverService {
  public shifts: EmployeeShift[] = [];
  public currentShift: EmployeeShift | null = null;

  private shiftsFetchedAt = 0;
  private readonly shiftsCacheTtlMs = 15 * 60 * 1000;
  private shiftsRequest: Promise<EmployeeShift[]> | null = null;

  constructor(private commonService: CommonService) {}

  async resolveCurrentShift(): Promise<EmployeeShift | null> {
    await this.ensureShiftsLoaded();

    const currentMinutes = moment().hours() * 60 + moment().minutes();

    this.currentShift =
      this.shifts.find((shift) => {
        if (!shift.start_time || !shift.end_time) {
          return false;
        }

        const startMinutes = this.extractMinutes(shift.start_time);
        const endMinutes = this.extractMinutes(shift.end_time);

        if (startMinutes > endMinutes) {
          return currentMinutes >= startMinutes || currentMinutes < endMinutes;
        }

        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      }) ?? null;

    return this.currentShift;
  }

  getAllShifts(): EmployeeShift[] {
    return this.shifts;
  }

  private async ensureShiftsLoaded(): Promise<void> {
    const isFresh = Date.now() - this.shiftsFetchedAt < this.shiftsCacheTtlMs;
    if (isFresh && this.shifts.length) {
      return;
    }

    if (!this.shiftsRequest) {
      this.shiftsRequest = firstValueFrom(
        this.commonService.get('EmployeeShifts?$filter=is_active eq true', true),
      )
        .then((response: any) => {
          this.shifts = response.value || [];
          this.shiftsFetchedAt = Date.now();
          return this.shifts;
        })
        .finally(() => {
          this.shiftsRequest = null;
        });
    }

    await this.shiftsRequest;
  }

  private extractMinutes(dateTime: string): number {
    const m = moment.parseZone(dateTime);

    return m.hours() * 60 + m.minutes();
  }
}
