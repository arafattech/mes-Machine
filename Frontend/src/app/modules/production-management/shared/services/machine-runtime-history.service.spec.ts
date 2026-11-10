import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import { MachineRuntimeHistoryService } from '@production-module/shared/services/machine-runtime-history.service';
import { factoryMidnight } from '@shared/utilities/date-format';

describe('MachineRuntimeHistoryService.getRangeAnalysis', () => {
  beforeEach(() => {
    jasmine.clock().install();
    // 08/10/2026 11:46 Asia/Dhaka
    jasmine.clock().mockDate(new Date('2026-10-08T05:46:00Z'));
  });

  afterEach(() => jasmine.clock().uninstall());

  it('splits a segment across factory days so no day exceeds its real span', async () => {
    TestBed.configureTestingModule({
      providers: [
        MachineRuntimeHistoryService,
        { provide: MachineStatesService, useValue: {} },
        {
          provide: CommonService,
          useValue: {
            // Active since 07/10/2026 13:14 Dhaka, still open
            get: () => of({ value: [{ machine_id: 7, machine_state_id: 1, started_at: '2026-10-07T07:14:00Z', ended_at: null, duration_seconds: null }] }),
          },
        },
      ],
    });
    const service = TestBed.inject(MachineRuntimeHistoryService);

    const { daily: days } = await service.getRangeAnalysis('7', factoryMidnight('2026-10-07'), factoryMidnight('2026-10-09'));

    expect(days.length).toBe(2);
    expect(days[0].hoursByState[1] * 3600).toBeCloseTo(10 * 3600 + 46 * 60, 0);
    expect(days[1].hoursByState[1] * 3600).toBeCloseTo(11 * 3600 + 46 * 60, 0);
  });

  it('summarizes clipped time, event count and longest event per state from a single request', async () => {
    const get = jasmine.createSpy('get').and.returnValue(
      of({
        value: [
          // Idle from 07/10 23:00 Dhaka — only the hour after midnight is inside the window
          { machine_id: 7, machine_state_id: 2, started_at: '2026-10-07T17:00:00Z', ended_at: '2026-10-07T19:00:00Z', duration_seconds: 7200 },
          // Active 01:00–03:00 Dhaka
          { machine_id: 7, machine_state_id: 1, started_at: '2026-10-07T19:00:00Z', ended_at: '2026-10-07T21:00:00Z', duration_seconds: 7200 },
          // Idle 03:00–03:30 Dhaka
          { machine_id: 7, machine_state_id: 2, started_at: '2026-10-07T21:00:00Z', ended_at: '2026-10-07T21:30:00Z', duration_seconds: 1800 },
        ],
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        MachineRuntimeHistoryService,
        { provide: MachineStatesService, useValue: {} },
        { provide: CommonService, useValue: { get } },
      ],
    });
    const service = TestBed.inject(MachineRuntimeHistoryService);

    const { stateSummary } = await service.getRangeAnalysis('7', factoryMidnight('2026-10-08'), factoryMidnight('2026-10-09'));

    expect(get).toHaveBeenCalledTimes(1);
    expect(stateSummary).toEqual([
      { stateId: 1, seconds: 7200, events: 1, longestSeconds: 7200 },
      { stateId: 2, seconds: 3600 + 1800, events: 2, longestSeconds: 3600 },
    ]);
  });
});
