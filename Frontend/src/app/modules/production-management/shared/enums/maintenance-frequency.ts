export enum MaintenanceFrequency {
  WEEKLY = 'weekly',
  TEN_DAYS = '10-days',
  FIFTEEN_DAYS = '15-days',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class MaintenanceFrequencyClass {
  static getLabel(frequency: MaintenanceFrequency | string): string {
    switch (frequency) {
      case MaintenanceFrequency.WEEKLY:
        return $localize`Weekly`;
      case MaintenanceFrequency.TEN_DAYS:
        return $localize`10 Days`;
      case MaintenanceFrequency.FIFTEEN_DAYS:
        return $localize`15 Days`;
      case MaintenanceFrequency.MONTHLY:
        return $localize`Monthly`;
      case MaintenanceFrequency.YEARLY:
        return $localize`Yearly`;
      default:
        return '';
    }
  }

  static getOptions(): { label: string; value: MaintenanceFrequency }[] {
    return Object.values(MaintenanceFrequency).map((value) => ({
      label: MaintenanceFrequencyClass.getLabel(value),
      value,
    }));
  }
}
