import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
  Subscription,
  combineLatest,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  shareReplay,
  skip,
  startWith,
  switchMap,
  take,
} from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { HttpClient } from '@angular/common/http';
import { Hall } from '@shared/model/hall';
import { PlantSelectionService } from '@production-module/shared/services/plant-selection.service';

const ACTIVE_MACHINES_QUERY =
  '$filter=is_active eq true or is_active eq 1&$expand=machinegroups,machinehalls';

@Injectable({
  providedIn: 'root',
})
export class ProductionService extends CommonService {
  protected resource = 'productions';
  public isLoading: boolean = false;
  public isMachinesLoading: boolean = false;

  private readonly plantSelection = inject(PlantSelectionService);

  /** Every active hall, unfiltered — emits only once loaded (error path emits `[]`). */
  private allHallsSubject = new ReplaySubject<Hall[]>(1);

  /** Active halls scoped to the header's selected plant (all halls for "All Plants"). */
  hallList$: Observable<Hall[]> = combineLatest([
    this.allHallsSubject,
    this.plantSelection.activePlantId$,
  ]).pipe(
    map(([halls, plantId]) => this.hallsOfPlant(halls, plantId)),
    // Emit `[]` until halls load, as the BehaviorSubject did — consumers (the production
    // sidebar builds its whole menu here) must not wait on the Halls request.
    startWith([] as Hall[]),
    shareReplay(1),
  );

  private machinesSubject = new BehaviorSubject<any[]>([]);
  machines$: Observable<any[]> = this.machinesSubject.asObservable();
  private machinesRequest?: Subscription;

  constructor(http: HttpClient) {
    super(http);
    this.loadHallList();

    // Switching plant resets the board to that plant's "All Machines".
    this.plantSelection.activePlantId$
      .pipe(skip(1), distinctUntilChanged())
      .subscribe(() => this.loadMachines('all-machines'));
  }

  loadHallList(): void {
    this.isLoading = true;
    this.get(
      'Halls?$expand=machines,plants&$filter=is_active eq true or is_active eq 1'
    ).subscribe({
      next: (response: any) => {
        const halls = response?.value || response;
        this.allHallsSubject.next(halls);
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Failed to load hall list:', err);
        this.allHallsSubject.next([]);
        this.isLoading = false;
      },
    });
  }

  /** ✅ Get machines and store them */
  loadMachines(type: string | number) {
    this.isMachinesLoading = true;
    // Cancel-previous: a slow earlier response (e.g. the previous plant) must not
    // overwrite the latest selection.
    this.machinesRequest?.unsubscribe();

    this.machinesRequest = this.machinesRequestFor(type).subscribe({
      next: (res: any) => {
        const machines = res?.value || res;
        this.machinesSubject.next(machines);
        this.isMachinesLoading = false;
      },
      error: (err) => {
        console.error('Failed to load machines:', err);
        this.machinesSubject.next([]);
        this.isMachinesLoading = false;
      },
    });
  }

  refreshHallList() {
    this.loadHallList();
  }

  private machinesRequestFor(type: string | number): Observable<any> {
    if (type !== 'all-machines') {
      return this.get(`Halls(${type})/machines?${ACTIVE_MACHINES_QUERY}`);
    }

    const plantId = this.plantSelection.activePlantId();
    if (plantId === null) {
      return this.get(`Machines?${ACTIVE_MACHINES_QUERY}`);
    }

    // Read the raw hall list with the plant id captured now, rather than `hallList$`,
    // so a plant switch can never be served the previous plant's cached halls.
    // One `Halls(id)/machines` request per plant hall: lodata generates invalid SQL for a
    // `machinehalls/any(...)` lambda over the many-to-many relation, and an `id in (...)`
    // list would grow the URL with machine count. A machine in several halls is deduped.
    return this.allHallsSubject.pipe(
      take(1),
      switchMap((halls) => {
        const plantHalls = this.hallsOfPlant(halls, plantId);
        if (plantHalls.length === 0) {
          return of([]);
        }
        return forkJoin(
          plantHalls.map((hall) =>
            this.get<{ value: any[] }>(`Halls(${hall.id})/machines?${ACTIVE_MACHINES_QUERY}`),
          ),
        ).pipe(
          // Sorted by id to match the unscoped `Machines` list order.
          map((responses) =>
            [
              ...new Map(
                responses.flatMap((res) => res.value).map((machine) => [machine.id, machine]),
              ).values(),
            ].sort((a, b) => a.id - b.id),
          ),
        );
      }),
    );
  }

  private hallsOfPlant(halls: Hall[], plantId: number | null): Hall[] {
    if (plantId === null) {
      return halls;
    }
    return halls.filter((hall) =>
      hall.plants?.some((plant) => plant.id === plantId),
    );
  }
}
