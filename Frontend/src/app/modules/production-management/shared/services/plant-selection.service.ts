import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { Plant } from '@shared/model/plant';

const STORAGE_KEY_PREFIX = 'selectedPlantId';

/**
 * Header plant selector state. `activePlantId` is `null` for "All Plants" and also
 * whenever the selector is disabled — so a plant persisted in localStorage never
 * silently filters production data on a deployment that has the selector turned off.
 * Persisted per user (not per browser), so shared shop-floor devices don't carry one person's
 * plant filter over to the next.
 */
@Injectable({
  providedIn: 'root',
})
export class PlantSelectionService {
  private readonly commonService = inject(CommonService);

  private readonly enabled = signal(false);
  private readonly selectedId = signal<number | null>(this.readStoredId());
  private plantsRequested = false;
  private plantsLoaded = false;

  public readonly plants = signal<Plant[]>([]);
  public readonly activePlantId = computed(() =>
    this.enabled() ? this.selectedId() : null,
  );
  public readonly activePlantId$: Observable<number | null> = toObservable(
    this.activePlantId,
  );

  /** Called on every (re-)login — the shared layout is recreated — so the stored choice is
   * re-read for whoever is logged in now. */
  enable(): void {
    this.enabled.set(true);
    this.selectedId.set(this.readStoredId());
    if (this.plantsRequested) {
      this.dropUnknownSelection(this.plants());
      return;
    }
    this.plantsRequested = true;
    this.commonService
      .get<{ value: Plant[] }>(
        'Plants?$filter=is_active eq true or is_active eq 1&$orderby=name',
      )
      .subscribe({
        next: (response) => {
          const plants = (response?.value ?? []).map((item) =>
            new Plant().deserialize(item),
          );
          this.plants.set(plants);
          this.plantsLoaded = true;
          this.dropUnknownSelection(plants);
        },
        error: (err: unknown) => {
          console.error('Failed to load plants:', err);
          this.plantsRequested = false;
        },
      });
  }

  select(plantId: number | null): void {
    this.selectedId.set(plantId);
    try {
      const key = this.storageKey();
      if (plantId === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, String(plantId));
      }
    } catch {
      // Storage unavailable (private mode / blocked) — selection still applies for this session.
    }
  }

  /** Falls back to "All Plants" when the stored plant is no longer an active plant. */
  private dropUnknownSelection(plants: Plant[]): void {
    const selectedId = this.selectedId();
    if (this.plantsLoaded && selectedId !== null && !plants.some((plant) => plant.id === selectedId)) {
      this.select(null);
    }
  }

  private readStoredId(): number | null {
    try {
      const stored = Number(localStorage.getItem(this.storageKey()));
      return Number.isInteger(stored) && stored > 0 ? stored : null;
    } catch {
      return null;
    }
  }

  private storageKey(): string {
    const userId = (JSON.parse(localStorage.getItem('userInfo') || '{}') as { id?: number }).id;
    return userId != null ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
  }
}
