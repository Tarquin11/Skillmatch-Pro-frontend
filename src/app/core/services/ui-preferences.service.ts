import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type TableDensity = 'compact' | 'comfortable';

@Injectable({ providedIn: 'root' })
export class UiPreferencesService {
  private readonly densityStorageKey = 'sm_table_density';
  private readonly densitySubject = new BehaviorSubject<TableDensity>(this.readDensity());

  readonly tableDensity$ = this.densitySubject.asObservable();

  get tableDensity(): TableDensity {
    return this.densitySubject.value;
  }

  setTableDensity(density: TableDensity): void {
    this.densitySubject.next(density);
    this.writeDensity(density);
  }

  private readDensity(): TableDensity {
    try {
      if (typeof localStorage === 'undefined') return 'comfortable';
      const raw = localStorage.getItem(this.densityStorageKey);
      if (raw === 'compact' || raw === 'comfortable') return raw;
      return 'comfortable';
    } catch {
      return 'comfortable';
    }
  }

  private writeDensity(density: TableDensity): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.densityStorageKey, density);
    } catch {
      // Ignore persistence failures (private mode, disabled storage, etc.).
    }
  }
}

