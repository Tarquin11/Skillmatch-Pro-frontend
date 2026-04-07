import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CurrentUserResponse, UserRole } from './auth-api.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminUsersApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  listUsers(): Observable<CurrentUserResponse[]> {
    return this.http.get<CurrentUserResponse[]>(`${this.baseUrl}/auth/users`);
  }

  updateUserRole(userId: number, role: UserRole): Observable<CurrentUserResponse> {
    return this.http.patch<CurrentUserResponse>(`${this.baseUrl}/auth/update-role/${userId}`, { role });
  }
}
