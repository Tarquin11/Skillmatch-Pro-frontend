import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Job {
  id: number;
  title?: string | null;
  description?: string | null;
  department?: string | null;
}

export interface JobCreatePayload {
  title: string;
  description?: string | null;
  departement?: string | null;
}

export interface JobUpdatePayload {
  title?: string;
  description?: string | null;
  departement?: string | null;
}

export interface JobListQuery {
  skip?: number;
  limit?: number;
  search?: string;
  department?: string;
  sort_by?: 'id' | 'title' | 'department';
  sort_dir?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class JobsApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  list(query?: JobListQuery): Observable<Job[]> {
    let params = new HttpParams();
    if (query?.skip !== undefined) params = params.set('skip', query.skip);
    if (query?.limit !== undefined) params = params.set('limit', query.limit);
    if (query?.search) params = params.set('search', query.search);
    if (query?.department) params = params.set('department', query.department);
    if (query?.sort_by) params = params.set('sort_by', query.sort_by);
    if (query?.sort_dir) params = params.set('sort_dir', query.sort_dir);
    return this.http.get<Job[]>(`${this.baseUrl}/jobs/`, { params });
  }

  create(payload: JobCreatePayload): Observable<Job> {
    return this.http.post<Job>(`${this.baseUrl}/jobs/`, payload);
  }

  update(jobId: number, payload: JobUpdatePayload): Observable<Job> {
    return this.http.put<Job>(`${this.baseUrl}/jobs/${jobId}`, payload);
  }

  delete(jobId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/jobs/${jobId}`);
  }
}
