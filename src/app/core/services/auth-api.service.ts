import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  Subscription,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface RefreshRequest {
  refresh_token: string;
}

export type UserRole = 'admin' | 'recruiter' | 'user';

export interface CurrentUserResponse {
  id: number;
  email: string;
  is_active: boolean;
  role: UserRole;
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const ACCESS_TOKEN_EXPIRES_AT_KEY = 'access_token_expires_at';
const AUTH_STORAGE_MODE_KEY = 'auth_storage_mode';
type AuthStorageMode = 'local' | 'session';

@Injectable({ providedIn: 'root' })
export class AuthApiService implements OnDestroy {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly refreshBufferSeconds = 30;
  private readonly refreshTickMs = 15000;

  private refreshInFlight$: Observable<LoginResponse> | null = null;
  private meInFlight$: Observable<CurrentUserResponse | null> | null = null;
  private silentRefreshSub: Subscription | null = null;
  private readonly currentUserSubject = new BehaviorSubject<CurrentUserResponse | null>(null);
  private readonly authLoadingSubject = new BehaviorSubject<boolean>(true);
  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly authLoading$ = this.authLoadingSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  ngOnDestroy(): void {
    this.stopSilentRefresh();
  }

  login(email: string, password: string, rememberMe = false): Observable<LoginResponse> {
    const body = new HttpParams().set('username', email).set('password', password);
    this.setStorageMode(rememberMe ? 'local' : 'session');

    return this.http
      .post<LoginResponse>(`${this.baseUrl}/auth/login`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        tap((res) => {
          this.persistTokens(res);
          this.startSilentRefresh();
        }),
      );
  }

  refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('Missing refresh token'));
    }

    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const payload: RefreshRequest = { refresh_token: refreshToken };
    this.refreshInFlight$ = this.http.post<LoginResponse>(`${this.baseUrl}/auth/refresh`, payload).pipe(
      tap((res) => {
        this.persistTokens(res);
      }),
      catchError((err) => {
        this.logout();
        return throwError(() => err);
      }),
      finalize(() => {
        this.refreshInFlight$ = null;
      }),
      shareReplay(1),
    );

    return this.refreshInFlight$;
  }

  initializeSession(): void {
    this.authLoadingSubject.next(true);
    if (!this.isAuthenticated()) {
      this.currentUserSubject.next(null);
      this.authLoadingSubject.next(false);
      return;
    }
    this.startSilentRefresh();
    this.resolveCurrentUser().subscribe({
      next: () => undefined,
      error: () => undefined,
    });
    if (this.shouldRefreshSoon(5)) {
      this.refreshToken().subscribe({
        next: () => undefined,
        error: () => undefined,
      });
    }
  }

  logout(): void {
    this.stopSilentRefresh();
    this.clearAuthKeys();
    this.currentUserSubject.next(null);
    this.authLoadingSubject.next(false);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  getAccessToken(): string | null {
    return this.readAuthKey(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return this.readAuthKey(REFRESH_TOKEN_KEY);
  }

  getCurrentUserSnapshot(): CurrentUserResponse | null {
    return this.currentUserSubject.value;
  }

  isAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'admin';
  }

  getMe(): Observable<CurrentUserResponse> {
    return this.http.get<CurrentUserResponse>(`${this.baseUrl}/auth/me`);
  }

  loadCurrentUser(): void {
    this.resolveCurrentUser().subscribe({
      next: () => undefined,
      error: () => undefined,
    });
  }

  resolveCurrentUser(): Observable<CurrentUserResponse | null> {
    if (!this.isAuthenticated()) {
      this.currentUserSubject.next(null);
      this.authLoadingSubject.next(false);
      return of(null);
    }

    const current = this.currentUserSubject.value;
    if (current) {
      this.authLoadingSubject.next(false);
      return of(current);
    }

    if (this.meInFlight$) {
      return this.meInFlight$;
    }

    this.authLoadingSubject.next(true);
    this.meInFlight$ = this.getMe().pipe(
      map((user) => {
        this.currentUserSubject.next(user);
        return user;
      }),
      catchError(() => {
        this.currentUserSubject.next(null);
        return of(null);
      }),
      finalize(() => {
        this.meInFlight$ = null;
        this.authLoadingSubject.next(false);
      }),
      shareReplay(1),
    );

    return this.meInFlight$;
  }

  shouldRefreshSoon(bufferSeconds = this.refreshBufferSeconds): boolean {
    const expiresAt = this.getAccessTokenExpiresAtMs();
    if (expiresAt === null) {
      return true;
    }
    const nowMs = Date.now();
    return expiresAt - nowMs <= bufferSeconds * 1000;
  }

  private startSilentRefresh(): void {
    if (this.silentRefreshSub) {
      return;
    }

    this.silentRefreshSub = new Subscription();
    const timerId = window.setInterval(() => {
      if (!this.isAuthenticated()) {
        return;
      }
      if (!this.shouldRefreshSoon()) {
        return;
      }

      this.refreshToken().subscribe({
        next: () => undefined,
        error: () => undefined,
      });
    }, this.refreshTickMs);

    this.silentRefreshSub.add(() => window.clearInterval(timerId));
  }

  private stopSilentRefresh(): void {
    if (!this.silentRefreshSub) {
      return;
    }
    this.silentRefreshSub.unsubscribe();
    this.silentRefreshSub = null;
  }

  private persistTokens(res: LoginResponse): void {
    this.clearTokenKeysOnly();

    if (res.access_token) {
      this.writeAuthKey(ACCESS_TOKEN_KEY, res.access_token);
    }
    if (res.refresh_token) {
      this.writeAuthKey(REFRESH_TOKEN_KEY, res.refresh_token);
    }

    const expiresIn = Number(res.expires_in ?? 0);
    if (Number.isFinite(expiresIn) && expiresIn > 0) {
      const expiresAt = Date.now() + expiresIn * 1000;
      this.writeAuthKey(ACCESS_TOKEN_EXPIRES_AT_KEY, String(expiresAt));
      return;
    }

    const fromJwt = this.decodeJwtExpiryMs(res.access_token);
    if (fromJwt !== null) {
      this.writeAuthKey(ACCESS_TOKEN_EXPIRES_AT_KEY, String(fromJwt));
    }
  }

  private getAccessTokenExpiresAtMs(): number | null {
    const raw = this.readAuthKey(ACCESS_TOKEN_EXPIRES_AT_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    const token = this.getAccessToken();
    if (!token) return null;
    return this.decodeJwtExpiryMs(token);
  }

  private decodeJwtExpiryMs(token: string | null | undefined): number | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;

    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const exp = Number(payload?.exp ?? 0);
      if (!Number.isFinite(exp) || exp <= 0) return null;
      return exp * 1000;
    } catch {
      return null;
    }
  }

  private setStorageMode(mode: AuthStorageMode): void {
    const local = this.localStorageRef();
    if (!local) return;
    try {
      local.setItem(AUTH_STORAGE_MODE_KEY, mode);
    } catch {
      // Ignore storage failures.
    }
  }

  private getStorageMode(): AuthStorageMode {
    const local = this.localStorageRef();
    if (local) {
      try {
        const saved = local.getItem(AUTH_STORAGE_MODE_KEY);
        if (saved === 'local' || saved === 'session') {
          return saved;
        }
      } catch {
        // Ignore storage failures.
      }
    }

    if (this.readFrom(this.localStorageRef(), ACCESS_TOKEN_KEY)) {
      return 'local';
    }
    if (this.readFrom(this.sessionStorageRef(), ACCESS_TOKEN_KEY)) {
      return 'session';
    }
    return 'session';
  }

  private activeStorage(): Storage | null {
    return this.getStorageMode() === 'local' ? this.localStorageRef() : this.sessionStorageRef();
  }

  private fallbackStorage(): Storage | null {
    return this.getStorageMode() === 'local' ? this.sessionStorageRef() : this.localStorageRef();
  }

  private readAuthKey(key: string): string | null {
    const primary = this.readFrom(this.activeStorage(), key);
    if (primary !== null) return primary;
    return this.readFrom(this.fallbackStorage(), key);
  }

  private writeAuthKey(key: string, value: string): void {
    const storage = this.activeStorage() ?? this.localStorageRef() ?? this.sessionStorageRef();
    if (!storage) return;
    try {
      storage.setItem(key, value);
    } catch {
      // Ignore storage failures.
    }
  }

  private clearTokenKeysOnly(): void {
    this.removeFrom(this.localStorageRef(), ACCESS_TOKEN_KEY);
    this.removeFrom(this.localStorageRef(), REFRESH_TOKEN_KEY);
    this.removeFrom(this.localStorageRef(), ACCESS_TOKEN_EXPIRES_AT_KEY);
    this.removeFrom(this.sessionStorageRef(), ACCESS_TOKEN_KEY);
    this.removeFrom(this.sessionStorageRef(), REFRESH_TOKEN_KEY);
    this.removeFrom(this.sessionStorageRef(), ACCESS_TOKEN_EXPIRES_AT_KEY);
  }

  private clearAuthKeys(): void {
    this.clearTokenKeysOnly();
    this.removeFrom(this.localStorageRef(), AUTH_STORAGE_MODE_KEY);
  }

  private readFrom(storage: Storage | null, key: string): string | null {
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  private removeFrom(storage: Storage | null, key: string): void {
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch {
      // Ignore storage failures.
    }
  }

  private localStorageRef(): Storage | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage;
    } catch {
      return null;
    }
  }

  private sessionStorageRef(): Storage | null {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      return sessionStorage;
    } catch {
      return null;
    }
  }
}
