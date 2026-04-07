import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CurrentUserResponse, UserRole } from './auth-api.service';

@Injectable({ providedIn: 'root' })
export class AdminUsersApiService {
  private readonly baseUrl = 'http://127.0.0.1:8000';

  constructor(private readonly http: HttpClient) {}

  listUsers(): Observable<CurrentUserResponse[]> {
    return this.http.get<CurrentUserResponse[]>(`${this.baseUrl}/auth/users`);
  }

  updateUserRole(userId: number, role: UserRole): Observable<CurrentUserResponse> {
    return this.http.patch<CurrentUserResponse>(`${this.baseUrl}/auth/update-role/${userId}`, { role });
  }
}

