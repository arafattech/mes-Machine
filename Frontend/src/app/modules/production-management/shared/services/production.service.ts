import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class ProductionService extends CommonService {
  protected resource = 'productions';
  public isLoading: boolean = false;
  public isMachinesLoading: boolean = false;

  private hallListSubject = new BehaviorSubject<any[]>([]);
  hallList$: Observable<any[]> = this.hallListSubject.asObservable();

  private machinesSubject = new BehaviorSubject<any[]>([]);
  machines$: Observable<any[]> = this.machinesSubject.asObservable();

  constructor(http: HttpClient) {
    super(http);
    this.loadHallList();
  }

  loadHallList(): void {
    this.isLoading = true;
    this.get(
      'Halls?$expand=machines&$filter=is_active eq true or is_active eq 1'
    ).subscribe({
      next: (response: any) => {
        const halls = response?.value || response;
        this.hallListSubject.next(halls);
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Failed to load hall list:', err);
        this.hallListSubject.next([]);
        this.isLoading = false;
      },
    });
  }

  /** ✅ Get machines and store them */
  loadMachines(type: string | number) {
    this.isMachinesLoading = true;
    let request$: Observable<any>;

    if (type === 'all-machines') {
      request$ = this.get(
        `Machines?$filter=is_active eq true or is_active eq 1&$expand=machinegroups,machinehalls`
      );
    } else {
      request$ = this.get(
        `Halls(${type})/machines?$filter=is_active eq true or is_active eq 1&$expand=machinegroups,machinehalls`
      );
    }

    request$.subscribe({
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
}
