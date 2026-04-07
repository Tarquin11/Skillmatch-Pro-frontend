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

@Injectable({ providedIn: 'root' })
export class AuthApiService implements OnDestroy {
  private readonly baseUrl = 'http://127.0.0.1:8000';
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

  login(email: string, password: string): Observable<LoginResponse> {
    const body = new HttpParams().set('username', email).set('password', password);

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
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
    this.currentUserSubject.next(null);
    this.authLoadingSubject.next(false);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
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
    if (res.access_token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, res.access_token);
    }
    if (res.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, res.refresh_token);
    }

    const expiresIn = Number(res.expires_in ?? 0);
    if (Number.isFinite(expiresIn) && expiresIn > 0) {
      const expiresAt = Date.now() + expiresIn * 1000;
      localStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, String(expiresAt));
      return;
    }

    const fromJwt = this.decodeJwtExpiryMs(res.access_token);
    if (fromJwt !== null) {
      localStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, String(fromJwt));
    }
  }

  private getAccessTokenExpiresAtMs(): number | null {
    const raw = localStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
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
}
