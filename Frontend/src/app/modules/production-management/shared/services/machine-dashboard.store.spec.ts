import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { SocketService } from '@app/services/socket.service';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import { MachineDashboardViewType } from '@shared/enums/machine-dashboard-view';
import { MachineDashboardStore } from '@production-module/shared/services/machine-dashboard.store';
import { MachineDurationService } from '@production-module/shared/services/machine-duration.service';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import { MachineRuntimeHistoryService } from '@production-module/shared/services/machine-runtime-history.service';
import {
  MachineProductionChange,
  ProductionRealtimeService,
} from '@production-module/shared/services/production-realtime.service';
import { CurrentWorkOrderShift, Metric, ProductionSummary } from '@production-module/shared/interface/interface';

interface MachineRecord {
  id: number;
  custom_id: string;
  machine_name: string;
  dashboard_view: string | null;
}

describe('MachineDashboardStore', () => {
  let machineResponses: Map<string, Observable<MachineRecord>>;
  let changes: Subject<MachineProductionChange>;
  let get: jasmine.Spy;
  let getCurrentWorkOrderShift: jasmine.Spy;
  let getOverview: jasmine.Spy;
  let store: MachineDashboardStore;

  const record = (id: number, view: string | null): MachineRecord => ({
    id,
    custom_id: `M-${id}`,
    machine_name: `Machine ${id}`,
    dashboard_view: view,
  });
  const workOrder = (id: number): CurrentWorkOrderShift => ({
    workOrder: { id, customId: `WO-${id}`, productName: null, quantity: 1, status: null },
    shift: null,
  });

  beforeEach(() => {
    machineResponses = new Map();
    changes = new Subject();
    get = jasmine.createSpy('get').and.callFake((url: string) => {
      const key = /^Machines\((\d+)\)/.exec(url)?.[1] ?? '';
      return machineResponses.get(key) ?? throwError(() => new Error('not found'));
    });
    getCurrentWorkOrderShift = jasmine
      .createSpy('getCurrentWorkOrderShift')
      .and.callFake((key: string) => of(workOrder(Number(key))));
    getOverview = jasmine.createSpy('getOverview');

    TestBed.configureTestingModule({
      providers: [
        MachineDashboardStore,
        { provide: CommonService, useValue: { get } },
        { provide: SocketService, useValue: { on: () => new Subject() } },
        {
          provide: MachineDurationService,
          useValue: {
            tick: signal(0),
            snapshot: () => ({ perState: {}, current: null, currentSeconds: 0, total: 0, lastSeenAt: null }),
          },
        },
        {
          provide: MachineStatesService,
          useValue: {
            getState: () => undefined,
            getLabel: () => 'Unknown',
            getIcon: () => 'question-mark',
            getColor: () => '#6a6d70',
            getTint: () => '#fff',
          },
        },
        { provide: MachineOverviewDataService, useValue: { getCurrentWorkOrderShift, getOverview } },
        { provide: MachineRuntimeHistoryService, useValue: { getEventsInRange: () => Promise.resolve([]) } },
        { provide: ProductionRealtimeService, useValue: { machineChanges$: () => changes.asObservable() } },
      ],
    });
    store = TestBed.inject(MachineDashboardStore);
  });

  it('renders the view stored on the machine', () => {
    machineResponses.set('5', of(record(5, MachineDashboardViewType.RUNTIME_STATUS)));

    store.setMachine('5', { customId: '', name: '' });

    expect(store.machineLoad()).toBe('ready');
    expect(store.view()).toBe(MachineDashboardViewType.RUNTIME_STATUS);
    expect(store.machine()?.name).toBe('Machine 5');
    expect(get.calls.mostRecent().args[0]).toBe('Machines(5)?$select=id,custom_id,machine_name,dashboard_view,has_temperature,has_rpm');
  });

  it('falls back to the OEE dashboard for a missing or unknown stored value', () => {
    machineResponses.set('5', of(record(5, null)));
    machineResponses.set('6', of(record(6, 'KANBAN')));

    store.setMachine('5', { customId: '', name: '' });
    expect(store.view()).toBe(MachineDashboardViewType.OEE_PRODUCTION);

    store.setMachine('6', { customId: '', name: '' });
    expect(store.view()).toBe(MachineDashboardViewType.OEE_PRODUCTION);
    expect(store.machineLoad()).toBe('ready');
  });

  it('shows the default dashboard with the placeholder identity when the machine cannot be loaded', () => {
    store.setMachine('9', { customId: 'M-9', name: 'Press 9' });

    expect(store.machineLoad()).toBe('error');
    expect(store.view()).toBe(MachineDashboardViewType.OEE_PRODUCTION);
    expect(store.machine()).toEqual({
      id: null,
      customId: 'M-9',
      name: 'Press 9',
      view: MachineDashboardViewType.OEE_PRODUCTION,
      hasTemperature: false,
      hasRpm: false,
    });
  });

  it('rejects a non-numeric machine key without calling the API', () => {
    store.setMachine('5) or (1', { customId: '', name: '' });

    expect(store.machineLoad()).toBe('error');
    expect(store.machineKey()).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('drops an overview response that arrives after switching machine', () => {
    const slowOverview = new Subject<{ production: ProductionSummary; oeeMetrics: Metric[]; oeeLive: null }>();
    getOverview.and.returnValue(slowOverview);
    machineResponses.set('5', of(record(5, null)));
    machineResponses.set('6', new Subject<MachineRecord>());

    store.setMachine('5', { customId: '', name: '' });
    store.setOverviewRange(new Date(), null);
    store.setMachine('6', { customId: '', name: '' });
    slowOverview.next({ production: { productionTarget: 99 } as ProductionSummary, oeeMetrics: [], oeeLive: null });

    expect(store.production()).toBeNull();
  });

  it('leaves the loading state when a reconnect supersedes the first load and fails', () => {
    machineResponses.set('5', new Subject<MachineRecord>());
    store.setMachine('5', { customId: 'M-5', name: 'Press 5' });

    machineResponses.set('5', throwError(() => new Error('offline')));
    changes.next({ kind: 'resync', workOrderIds: [] });

    expect(store.machineLoad()).toBe('error');
    expect(store.view()).toBe(MachineDashboardViewType.OEE_PRODUCTION);
  });

  it('ignores a late response for the previous machine after switching', () => {
    const slow = new Subject<MachineRecord>();
    machineResponses.set('5', slow);
    machineResponses.set('6', of(record(6, MachineDashboardViewType.SAP_FIORI)));

    store.setMachine('5', { customId: '', name: '' });
    store.loadCurrentWorkOrder();
    store.setMachine('6', { customId: '', name: '' });
    store.loadCurrentWorkOrder();
    slow.next(record(5, MachineDashboardViewType.RUNTIME_STATUS));

    expect(store.machine()?.id).toBe(6);
    expect(store.view()).toBe(MachineDashboardViewType.SAP_FIORI);
    expect(store.currentWorkOrder()?.workOrder?.id).toBe(6);
  });

  it('clears machine-scoped data before loading the next machine', () => {
    machineResponses.set('5', of(record(5, null)));
    store.setMachine('5', { customId: '', name: '' });
    store.loadCurrentWorkOrder();
    expect(store.currentWorkOrder()?.workOrder?.id).toBe(5);

    getCurrentWorkOrderShift.and.returnValue(new Subject<CurrentWorkOrderShift>());
    machineResponses.set('6', new Subject<MachineRecord>());
    store.setMachine('6', { customId: '', name: '' });

    expect(store.machine()).toBeNull();
    expect(store.machineLoad()).toBe('loading');
    expect(store.currentWorkOrder()).toBeNull();
  });

  it('re-resolves the view silently on a socket resync and keeps the screen if that fails', () => {
    machineResponses.set('5', of(record(5, MachineDashboardViewType.OEE_PRODUCTION)));
    store.setMachine('5', { customId: '', name: '' });

    machineResponses.set('5', of(record(5, MachineDashboardViewType.SAP_FIORI)));
    changes.next({ kind: 'resync', workOrderIds: [] });
    expect(store.view()).toBe(MachineDashboardViewType.SAP_FIORI);

    machineResponses.set('5', throwError(() => new Error('offline')));
    changes.next({ kind: 'resync', workOrderIds: [] });
    expect(store.machineLoad()).toBe('ready');
    expect(store.view()).toBe(MachineDashboardViewType.SAP_FIORI);
  });

  it('fetches nothing production-related until a view asks for it (Runtime never does)', () => {
    machineResponses.set('5', of(record(5, MachineDashboardViewType.RUNTIME_STATUS)));
    store.setMachine('5', { customId: '', name: '' });
    changes.next({ kind: 'production', workOrderIds: [1] });
    changes.next({ kind: 'resync', workOrderIds: [] });

    expect(getCurrentWorkOrderShift).not.toHaveBeenCalled();
    expect(store.currentWorkOrder()).toBeNull();
  });

  it('stops reacting to realtime changes once destroyed', () => {
    machineResponses.set('5', of(record(5, null)));
    store.setMachine('5', { customId: '', name: '' });
    store.loadCurrentWorkOrder();
    const callsBefore = getCurrentWorkOrderShift.calls.count();

    TestBed.resetTestingModule();
    changes.next({ kind: 'production', workOrderIds: [1] });

    expect(getCurrentWorkOrderShift.calls.count()).toBe(callsBefore);
  });
});
