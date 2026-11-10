import {
  DEFAULT_MACHINE_DASHBOARD_VIEW,
  MachineDashboardViewType,
  MachineDashboardViewTypeClass,
} from '@shared/enums/machine-dashboard-view';

describe('MachineDashboardViewTypeClass', () => {
  it('defaults to the OEE & Production dashboard', () => {
    expect(DEFAULT_MACHINE_DASHBOARD_VIEW).toBe(MachineDashboardViewType.OEE_PRODUCTION);
  });

  it('resolves every supported value to itself', () => {
    for (const view of Object.values(MachineDashboardViewType)) {
      expect(MachineDashboardViewTypeClass.resolve(view)).toBe(view);
    }
  });

  it('falls back to the default for missing, wrongly cased or unknown values', () => {
    for (const raw of [null, undefined, '', 'sap_fiori', 'KANBAN', 42, {}]) {
      expect(MachineDashboardViewTypeClass.resolve(raw)).toBe(DEFAULT_MACHINE_DASHBOARD_VIEW);
    }
  });

  it('offers one labelled option per enum member', () => {
    const options = MachineDashboardViewTypeClass.getOptions();
    expect(options.map((o) => o.value)).toEqual(Object.values(MachineDashboardViewType));
    expect(options.every((o) => o.label.length > 0)).toBeTrue();
  });
});
