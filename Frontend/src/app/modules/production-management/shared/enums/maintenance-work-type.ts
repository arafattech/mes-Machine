export enum MaintenanceWorkType {
  MAINT = 'Maintenance',
  CLEANING_MAINT = 'Cleaning Maintenance',
  COT_GRINDING_MAINT = 'Cot Grinding & Maintenance',
}

export class MaintenanceWorkTypeClass {
  static getLabel(type: MaintenanceWorkType | string): string {
    switch (type) {
      case MaintenanceWorkType.MAINT:
        return $localize`Maintenance`;
      case MaintenanceWorkType.CLEANING_MAINT:
        return $localize`Cleaning Maintenance`;
      case MaintenanceWorkType.COT_GRINDING_MAINT:
        return $localize`Cot Grinding & Maintenance`;
      default:
        return '';
    }
  }

  static getOptions(): { label: string; value: MaintenanceWorkType }[] {
    return Object.values(MaintenanceWorkType).map((value) => ({
      label: MaintenanceWorkTypeClass.getLabel(value),
      value,
    }));
  }
}
