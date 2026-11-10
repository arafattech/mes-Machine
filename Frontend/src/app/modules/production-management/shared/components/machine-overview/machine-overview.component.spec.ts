import { CUSTOM_ELEMENTS_SCHEMA, EventEmitter, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { MachineDashboardViewType } from '@shared/enums/machine-dashboard-view';
import { MachineOverviewComponent } from '@production-module/shared/components/machine-overview/machine-overview.component';
import { MachineDashboardStore, MachineLoadState } from '@production-module/shared/services/machine-dashboard.store';

describe('MachineOverviewComponent (dashboard host)', () => {
  const machineLoad = signal<MachineLoadState>('loading');
  const machineKey = signal<string | null>('5');
  const storedView = signal<MachineDashboardViewType>(MachineDashboardViewType.OEE_PRODUCTION);
  const fakeStore = {
    machineLoad,
    machineKey,
    view: computed(() => storedView()),
    setMachine: jasmine.createSpy('setMachine'),
    retry: jasmine.createSpy('retry'),
    notifyProductionLogged: jasmine.createSpy('notifyProductionLogged'),
  };
  let fixture: ComponentFixture<MachineOverviewComponent>;

  const render = (load: MachineLoadState, view: MachineDashboardViewType, key: string | null = '5'): HTMLElement => {
    machineLoad.set(load);
    storedView.set(view);
    machineKey.set(key);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MachineOverviewComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: CommonService, useValue: { sidenavHidden: new EventEmitter<boolean>() } },
        { provide: ActivatedRoute, useValue: { queryParams: of({ machineId: '5', id: 'M-5', name: 'Press 5' }) } },
      ],
    }).overrideComponent(MachineOverviewComponent, {
      set: { providers: [{ provide: MachineDashboardStore, useValue: fakeStore }] },
    });
    fixture = TestBed.createComponent(MachineOverviewComponent);
  });

  it('passes the routed machine to the store', () => {
    render('loading', MachineDashboardViewType.OEE_PRODUCTION);
    expect(fakeStore.setMachine).toHaveBeenCalledWith('5', { customId: 'M-5', name: 'Press 5' });
  });

  it('shows only a busy indicator while the machine configuration loads', () => {
    const el = render('loading', MachineDashboardViewType.RUNTIME_STATUS);
    expect(el.querySelector('ui5-busy-indicator')).not.toBeNull();
    expect(el.querySelector('app-machine-runtime-dashboard')).toBeNull();
    expect(el.querySelector('app-oee-production-dashboard')).toBeNull();
  });

  const cases: [MachineDashboardViewType, string][] = [
    [MachineDashboardViewType.OEE_PRODUCTION, 'app-oee-production-dashboard'],
    [MachineDashboardViewType.RUNTIME_STATUS, 'app-machine-runtime-dashboard'],
    [MachineDashboardViewType.SAP_FIORI, 'app-sap-fiori-machine-dashboard'],
  ];
  for (const [view, selector] of cases) {
    it(`renders only ${selector} for ${view}`, () => {
      const el = render('ready', view);
      const rendered = cases.map(([, s]) => s).filter((s) => el.querySelector(s));
      expect(rendered).toEqual([selector]);
    });
  }

  it('keeps the module usable when the configuration cannot be loaded', () => {
    const el = render('error', MachineDashboardViewType.OEE_PRODUCTION);
    expect(el.querySelector('ui5-message-strip')).not.toBeNull();
    expect(el.querySelector('app-oee-production-dashboard')).not.toBeNull();
  });

  it('renders no dashboard without a machine', () => {
    const el = render('error', MachineDashboardViewType.OEE_PRODUCTION, null);
    expect(el.querySelector('ui5-message-strip')).not.toBeNull();
    expect(el.querySelector('app-oee-production-dashboard')).toBeNull();
  });

  it('switches dashboards when the resolved view changes', () => {
    let el = render('ready', MachineDashboardViewType.OEE_PRODUCTION);
    expect(el.querySelector('app-oee-production-dashboard')).not.toBeNull();

    el = render('ready', MachineDashboardViewType.SAP_FIORI);
    expect(el.querySelector('app-oee-production-dashboard')).toBeNull();
    expect(el.querySelector('app-sap-fiori-machine-dashboard')).not.toBeNull();
  });
});
