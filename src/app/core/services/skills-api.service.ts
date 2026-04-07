import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Skill {
  id: number;
  name?: string | null;
}

export interface SkillCreatePayload {
  name: string;
}

export interface SkillUpdatePayload {
  name?: string;
}

export interface SkillListQuery {
  skip?: number;
  limit?: number;
  search?: string;
  sort_by?: 'id' | 'name';
  sort_dir?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class SkillsApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  list(query?: SkillListQuery): Observable<Skill[]> {
    let params = new HttpParams();
    if (query?.skip !== undefined) params = params.set('skip', query.skip);
    if (query?.limit !== undefined) params = params.set('limit', query.limit);
    if (query?.search) params = params.set('search', query.search);
    if (query?.sort_by) params = params.set('sort_by', query.sort_by);
    if (query?.sort_dir) params = params.set('sort_dir', query.sort_dir);
    return this.http.get<Skill[]>(`${this.baseUrl}/skills/`, { params });
  }

  create(payload: SkillCreatePayload): Observable<Skill> {
    return this.http.post<Skill>(`${this.baseUrl}/skills/`, payload);
  }

  update(skillId: number, payload: SkillUpdatePayload): Observable<Skill> {
    return this.http.put<Skill>(`${this.baseUrl}/skills/${skillId}`, payload);
  }

  delete(skillId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/skills/${skillId}`);
  }
}
