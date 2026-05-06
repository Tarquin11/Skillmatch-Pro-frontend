import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, switchMap, throwError } from 'rxjs';
import { CurrentUserResponse, UserRole } from './auth-api.service';
import { environment } from '../../../environments/environment';

export interface AdminUserCreatePayload {
  email: string;
  password: string;
  role: UserRole;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  listUsers(): Observable<CurrentUserResponse[]> {
    return this.http.get<CurrentUserResponse[]>(`${this.baseUrl}/auth/users`);
  }

  createUser(payload: AdminUserCreatePayload): Observable<CurrentUserResponse> {
    return this.http
      .post<CurrentUserResponse>(`${this.baseUrl}/auth/users`, payload, {
        headers: { 'x-skip-global-error': '1' },
      })
      .pipe(
        catchError((err: unknown) => {
          const httpErr = err as HttpErrorResponse;
          if (httpErr?.status !== 405) {
            return throwError(() => err);
          }
          return this.createUserViaSignupFallback(payload);
        }),
      );
  }

  updateUserRole(userId: number, role: UserRole): Observable<CurrentUserResponse> {
    return this.http.patch<CurrentUserResponse>(`${this.baseUrl}/auth/update-role/${userId}`, { role });
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/auth/users/${userId}`);
  }

  private createUserViaSignupFallback(payload: AdminUserCreatePayload): Observable<CurrentUserResponse> {
    const signupRole: UserRole = payload.role === 'admin' ? 'user' : payload.role;
    return this.http
      .post<CurrentUserResponse>(`${this.baseUrl}/auth/signup`, {
        email: payload.email,
        password: payload.password,
        role: signupRole,
      })
      .pipe(
        switchMap((created) => {
          if (created.role === payload.role) {
            return of(created);
          }
          return this.updateUserRole(created.id, payload.role);
        }),
      );
  }
}
