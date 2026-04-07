import { Injectable } from '@angular/core';
import { LanguageCode } from '../i18n/translations';
import { AuthApiService } from './auth-api.service';

type SortDirection = 'asc' | 'desc';

interface StoredSortPreference {
  key: string;
  direction: SortDirection;
}

interface StoredTablePreference {
  pageSize?: number;
  sort?: StoredSortPreference;
  visibleColumns?: Record<string, boolean>;
}

interface StoredUserPreferences {
  language?: LanguageCode;
  tables?: Record<string, StoredTablePreference>;
}

export interface TableSortPreference<K extends string = string> {
  key: K;
  direction: SortDirection;
}

export interface TablePreference<K extends string = string, C extends string = string> {
  pageSize?: number;
  sort?: TableSortPreference<K>;
  visibleColumns?: Record<C, boolean>;
}

const STORAGE_KEY_PREFIX = 'sm_user_prefs_v1';

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  constructor(private readonly auth: AuthApiService) {}

  getLanguage(): LanguageCode | null {
    const prefs = this.readCurrentScope();
    return prefs.language ?? null;
  }

  setLanguage(language: LanguageCode): void {
    const prefs = this.readCurrentScope();
    prefs.language = language;
    this.writeCurrentScope(prefs);
  }

  getTablePreference<K extends string = string, C extends string = string>(tableId: string): TablePreference<K, C> {
    const prefs = this.readCurrentScope();
    const table = prefs.tables?.[tableId];
    if (!table || typeof table !== 'object') {
      return {};
    }
    return {
      pageSize: Number.isFinite(table.pageSize) ? Number(table.pageSize) : undefined,
      sort: table.sort
        ? {
            key: String(table.sort.key) as K,
            direction: table.sort.direction === 'asc' ? 'asc' : 'desc',
          }
        : undefined,
      visibleColumns: table.visibleColumns as Record<C, boolean> | undefined,
    };
  }

  setTablePageSize(tableId: string, pageSize: number): void {
    if (!Number.isFinite(pageSize) || pageSize <= 0) return;
    const prefs = this.readCurrentScope();
    const table = this.getOrCreateTablePreference(prefs, tableId);
    table.pageSize = Math.floor(pageSize);
    this.writeCurrentScope(prefs);
  }

  setTableSort<K extends string>(tableId: string, sort: TableSortPreference<K>): void {
    const prefs = this.readCurrentScope();
    const table = this.getOrCreateTablePreference(prefs, tableId);
    table.sort = {
      key: String(sort.key),
      direction: sort.direction === 'asc' ? 'asc' : 'desc',
    };
    this.writeCurrentScope(prefs);
  }

  setTableVisibleColumns<C extends string>(tableId: string, visibleColumns: Record<C, boolean>): void {
    const prefs = this.readCurrentScope();
    const table = this.getOrCreateTablePreference(prefs, tableId);
    table.visibleColumns = Object.entries(visibleColumns).reduce<Record<string, boolean>>((acc, [key, value]) => {
      acc[key] = Boolean(value);
      return acc;
    }, {});
    this.writeCurrentScope(prefs);
  }

  private getOrCreateTablePreference(prefs: StoredUserPreferences, tableId: string): StoredTablePreference {
    if (!prefs.tables) {
      prefs.tables = {};
    }
    const existing = prefs.tables[tableId];
    if (existing && typeof existing === 'object') {
      return existing;
    }
    prefs.tables[tableId] = {};
    return prefs.tables[tableId];
  }

  private readCurrentScope(): StoredUserPreferences {
    try {
      if (typeof localStorage === 'undefined') return {};
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) return {};
      const parsed = JSON.parse(raw) as StoredUserPreferences | null;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch {
      return {};
    }
  }

  private writeCurrentScope(value: StoredUserPreferences): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.storageKey(), JSON.stringify(value));
    } catch {
      // Ignore persistence failures (private mode, disabled storage, etc.).
    }
  }

  private storageKey(): string {
    return `${STORAGE_KEY_PREFIX}:${this.currentScopeId()}`;
  }

  private currentScopeId(): string {
    const user = this.auth.getCurrentUserSnapshot();
    if (user?.id !== undefined && user?.id !== null) {
      return `user_${user.id}`;
    }
    if (user?.email) {
      return `email_${user.email.trim().toLowerCase()}`;
    }
    return 'guest';
  }
}

