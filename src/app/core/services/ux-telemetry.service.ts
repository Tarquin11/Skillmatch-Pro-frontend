import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface UxTelemetryEvent {
  id: string;
  event: string;
  timestamp_utc: string;
  stage: string;
  session_id: string;
  path: string;
  payload: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class UxTelemetryService {
  private readonly storageKey = 'sm_ux_telemetry_events';
  private readonly sessionStorageKey = 'sm_ux_telemetry_session_id';
  private readonly maxEvents = 1000;
  private readonly maxPayloadStringLength = 160;
  private readonly maxPayloadEntries = 40;
  private readonly sessionId = this.resolveSessionId();

  track(event: string, payload: Record<string, unknown> = {}): void {
    const normalizedEvent = event.trim();
    if (!normalizedEvent) return;

    const entry: UxTelemetryEvent = {
      id: this.newId(),
      event: normalizedEvent,
      timestamp_utc: new Date().toISOString(),
      stage: environment.stage,
      session_id: this.sessionId,
      path: this.currentPath(),
      payload: this.sanitizePayload(payload),
    };

    const existing = this.readEvents();
    existing.push(entry);
    const trimmed = existing.slice(-this.maxEvents);
    this.writeEvents(trimmed);
  }

  list(): UxTelemetryEvent[] {
    return this.readEvents();
  }

  clear(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore storage failures.
    }
  }

  private sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
    const entries = Object.entries(payload).slice(0, this.maxPayloadEntries);
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      if (typeof value === 'string') {
        sanitized[key] = value.slice(0, this.maxPayloadStringLength);
        continue;
      }
      if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null ||
        value === undefined
      ) {
        sanitized[key] = value;
        continue;
      }
      if (Array.isArray(value)) {
        sanitized[key] = value.slice(0, 20).map((item) => this.scalarize(item));
        continue;
      }
      sanitized[key] = this.scalarize(value);
    }
    return sanitized;
  }

  private scalarize(value: unknown): unknown {
    if (typeof value === 'string') return value.slice(0, this.maxPayloadStringLength);
    if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
      return value;
    }
    return String(value).slice(0, this.maxPayloadStringLength);
  }

  private readEvents(): UxTelemetryEvent[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as UxTelemetryEvent[] | null;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && typeof item.event === 'string' && typeof item.timestamp_utc === 'string');
    } catch {
      return [];
    }
  }

  private writeEvents(events: UxTelemetryEvent[]): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.storageKey, JSON.stringify(events));
    } catch {
      // Ignore storage failures.
    }
  }

  private resolveSessionId(): string {
    try {
      if (typeof sessionStorage === 'undefined') {
        return this.newId();
      }
      const existing = sessionStorage.getItem(this.sessionStorageKey);
      if (existing) return existing;
      const created = this.newId();
      sessionStorage.setItem(this.sessionStorageKey, created);
      return created;
    } catch {
      return this.newId();
    }
  }

  private currentPath(): string {
    try {
      if (typeof window === 'undefined') return '';
      return window.location.pathname || '';
    } catch {
      return '';
    }
  }

  private newId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

