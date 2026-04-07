import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Employee {
  id: number;
  employee_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  department?: string | null;
  position?: string | null;
  performance_score?: string | null;
  hire_date?: string | null;
}

export interface EmployeeCreatePayload {
  employeeNumber: string;
  first_name: string;
  last_name: string;
  email: string;
  full_name?: string | null;
  department?: string | null;
  position?: string | null;
}

export interface EmployeeUpdatePayload {
  first_name?: string;
  last_name?: string;
  full_name?: string | null;
  email?: string;
  department?: string | null;
  position?: string | null;
}

export interface EmployeeListQuery {
  skip?: number;
  limit?: number;
  search?: string;
  department?: string;
  position?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class EmployeesApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  list(query?: EmployeeListQuery): Observable<Employee[]> {
    let params = new HttpParams();
    if (query?.skip !== undefined) params = params.set('skip', query.skip);
    if (query?.limit !== undefined) params = params.set('limit', query.limit);
    if (query?.search) params = params.set('search', query.search);
    if (query?.department) params = params.set('department', query.department);
    if (query?.position) params = params.set('position', query.position);
    if (query?.sort_by) params = params.set('sort_by', query.sort_by);
    if (query?.sort_dir) params = params.set('sort_dir', query.sort_dir);
    return this.http.get<Employee[]>(`${this.baseUrl}/employees/`, { params });
  }

  create(payload: EmployeeCreatePayload): Observable<Employee> {
    return this.http.post<Employee>(`${this.baseUrl}/employees/`, payload);
  }

  update(employeeId: number, payload: EmployeeUpdatePayload): Observable<Employee> {
    return this.http.put<Employee>(`${this.baseUrl}/employees/${employeeId}`, payload);
  }

  delete(employeeId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/employees/${employeeId}`);
  }
}
