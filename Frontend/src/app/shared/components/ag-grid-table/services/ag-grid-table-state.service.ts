import { Injectable } from '@angular/core';
import { AgGridTableStoredState } from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';

@Injectable({
  providedIn: 'root',
})
export class AgGridTableStateService {
  private readonly storagePrefix = 'mes-ag-grid';

  load(gridId: string): AgGridTableStoredState | null {
    if (!gridId) {
      return null;
    }

    try {
      const rawValue = localStorage.getItem(this.buildStorageKey(gridId));
      return rawValue ? (JSON.parse(rawValue) as AgGridTableStoredState) : null;
    } catch {
      return null;
    }
  }

  save(gridId: string, state: AgGridTableStoredState) {
    if (!gridId) {
      return;
    }

    try {
      localStorage.setItem(this.buildStorageKey(gridId), JSON.stringify(state));
    } catch {
      // localStorage quota exceeded — silently skip
    }
  }

  clear(gridId: string) {
    if (!gridId) {
      return;
    }
    localStorage.removeItem(this.buildStorageKey(gridId));
  }

  private buildStorageKey(gridId: string) {
    return `${this.storagePrefix}:${gridId}`;
  }
}
