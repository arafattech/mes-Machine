import { TestBed } from '@angular/core/testing';
import { NEVER, Subject, of } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { SocketService } from '@app/services/socket.service';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import {
  MachineDurationService,
  MachineStateEventRow,
} from '@production-module/shared/services/machine-duration.service';

const ACTIVE = 1;
const IDLE = 2;

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('MachineDurationService (today totals clipped to factory midnight)', () => {
  let openRows: MachineStateEventRow[];
  let closedRows: MachineStateEventRow[];
  let runtimeEvents: Subject<unknown>;

  function createService(): MachineDurationService {
    TestBed.configureTestingModule({
      providers: [
        MachineDurationService,
        {
          provide: SocketService,
          useValue: { on: (event: string) => (event === 'machine_status_runtime' ? runtimeEvents : NEVER) },
        },
        { provide: MachineStatesService, useValue: { getByName: () => undefined } },
        {
          provide: CommonService,
          useValue: {
            get: (url: string) => of({ value: url.includes('ended_at eq null') ? openRows : closedRows }),
          },
        },
      ],
    });
    return TestBed.inject(MachineDurationService);
  }

  beforeEach(() => {
    jasmine.clock().install();
    // 08/10/2026 11:46 Asia/Dhaka
    jasmine.clock().mockDate(new Date('2026-10-08T05:46:00Z'));
    openRows = [];
    closedRows = [];
    runtimeEvents = new Subject();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('counts an open segment that began yesterday only from midnight, while "In state for" stays continuous', async () => {
    // Active since 07/10/2026 13:14 Dhaka
    openRows = [{ machine_id: 7, machine_state_id: ACTIVE, started_at: '2026-10-07T07:14:00Z', ended_at: null, duration_seconds: null }];

    const service = createService();
    await flushMicrotasks();
    const snapshot = service.snapshot('7');

    expect(snapshot.perState[ACTIVE]).toBe(11 * 3600 + 46 * 60);
    expect(snapshot.currentSeconds).toBe(22 * 3600 + 32 * 60);
  });

  it('counts only the post-midnight part of a closed segment crossing midnight', async () => {
    // Idle 07/10 23:00 → 08/10 01:00 Dhaka
    closedRows = [{ machine_id: 7, machine_state_id: IDLE, started_at: '2026-10-07T17:00:00Z', ended_at: '2026-10-07T19:00:00Z', duration_seconds: 7200 }];

    const service = createService();
    await flushMicrotasks();

    expect(service.snapshot('7').perState[IDLE]).toBe(3600);
  });

  it('keeps only the post-midnight part when a state closes right after midnight, before any tick', async () => {
    // 07/10 23:50 Dhaka: Active since 23:30
    jasmine.clock().mockDate(new Date('2026-10-07T17:50:00Z'));
    openRows = [{ machine_id: 7, machine_state_id: ACTIVE, started_at: '2026-10-07T17:30:00Z', ended_at: null, duration_seconds: null }];
    const service = createService();
    await flushMicrotasks();
    expect(service.snapshot('7').perState[ACTIVE]).toBe(20 * 60);

    // 08/10 00:30 Dhaka — date jumps without the 1 s interval firing, then the state changes.
    jasmine.clock().mockDate(new Date('2026-10-07T18:30:00Z'));
    runtimeEvents.next({ machine_id: 7, machine_state_id: IDLE, status: 'IDLE', status_started_at: '2026-10-07T18:30:00Z', elapsed_seconds: 0 });
    const snapshot = service.snapshot('7');

    expect(snapshot.perState[ACTIVE]).toBe(30 * 60);
    expect(snapshot.perState[IDLE]).toBe(0);
    expect(snapshot.currentSeconds).toBe(0);
  });

  it('restarts today totals at midnight while "In state for" keeps counting', async () => {
    // 07/10 23:00 Dhaka: Active since 22:00
    jasmine.clock().mockDate(new Date('2026-10-07T17:00:00Z'));
    openRows = [{ machine_id: 7, machine_state_id: ACTIVE, started_at: '2026-10-07T16:00:00Z', ended_at: null, duration_seconds: null }];
    const service = createService();
    await flushMicrotasks();

    jasmine.clock().tick(2 * 3600 * 1000); // 08/10 01:00 Dhaka
    const snapshot = service.snapshot('7');

    expect(snapshot.perState[ACTIVE]).toBe(3600);
    expect(snapshot.currentSeconds).toBe(3 * 3600);
  });
});
