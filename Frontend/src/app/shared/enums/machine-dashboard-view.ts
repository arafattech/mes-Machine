/** Per-machine dashboard layout rendered at `/production/mco`, stored in `machines.dashboard_view`. */
export enum MachineDashboardViewType {
  OEE_PRODUCTION = 'OEE_PRODUCTION',
  RUNTIME_STATUS = 'RUNTIME_STATUS',
  SAP_FIORI = 'SAP_FIORI',
}

/** Used for machines with no (or an unrecognised) stored value — the original OEE dashboard. */
export const DEFAULT_MACHINE_DASHBOARD_VIEW = MachineDashboardViewType.OEE_PRODUCTION;

const VIEW_TYPES = new Set<string>(Object.values(MachineDashboardViewType));

export class MachineDashboardViewTypeClass {
  static getLabel(view: MachineDashboardViewType): string {
    switch (view) {
      case MachineDashboardViewType.OEE_PRODUCTION:
        return $localize`OEE & Production Analytics`;
      case MachineDashboardViewType.RUNTIME_STATUS:
        return $localize`Runtime & Machine Status`;
      case MachineDashboardViewType.SAP_FIORI:
        return $localize`SAP Fiori Dashboard`;
    }
  }

  static getOptions(): { label: string; value: MachineDashboardViewType }[] {
    return Object.values(MachineDashboardViewType).map((value) => ({
      label: MachineDashboardViewTypeClass.getLabel(value),
      value,
    }));
  }

  /** Validation is frontend-only, so anything read back from the API is untrusted: unknown,
   * empty or legacy values resolve to the default instead of breaking the dashboard host. */
  static resolve(raw: unknown): MachineDashboardViewType {
    return typeof raw === 'string' && VIEW_TYPES.has(raw)
      ? (raw as MachineDashboardViewType)
      : DEFAULT_MACHINE_DASHBOARD_VIEW;
  }
}
