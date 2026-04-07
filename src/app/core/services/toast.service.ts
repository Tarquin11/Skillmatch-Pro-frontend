import { Injectable, signal } from '@angular/core';

export type ToastLevel = 'error' | 'success' | 'info';

export interface ToastItem {
  id: number;
  level: ToastLevel;
  i18nKey: string;
  detail?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _items = signal<ToastItem[]>([]);
  private nextId = 1;
  readonly items = this._items.asReadonly();

  showError(i18nKey: string, detail?: string, durationMs = 5000): void {
    this.push('error', i18nKey, detail, durationMs);
  }

  showSuccess(i18nKey: string, detail?: string, durationMs = 3500): void {
    this.push('success', i18nKey, detail, durationMs);
  }

  showInfo(i18nKey: string, detail?: string, durationMs = 4000): void {
    this.push('info', i18nKey, detail, durationMs);
  }

  dismiss(id: number): void {
    this._items.update((items) => items.filter((x) => x.id !== id));
  }

  private push(level: ToastLevel, i18nKey: string, detail?: string, durationMs = 5000): void {
    const toast: ToastItem = {
      id: this.nextId++,
      level,
      i18nKey,
      detail,
    };
    this._items.update((items) => [...items, toast]);
    window.setTimeout(() => this.dismiss(toast.id), Math.max(1200, durationMs));
  }
}
