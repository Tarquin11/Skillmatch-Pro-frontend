import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface JobMatchRequest {
  job_title: string;
  required_skills: string[];
  min_experience: number;
  limit: number;
}

export interface MatchCandidate {
  employee_id?: number;
  full_name?: string;
  score?: number;
  score_percent?: number;
  predicted_title?: string | null;
  predicted_experience_years?: number | null;
}

export interface JobMatchResponse {
  results?: MatchCandidate[];
  ranked?: MatchCandidate[];
  candidates?: MatchCandidate[];
  total_results?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  has_next?: boolean;
  has_prev?: boolean;
  sort_by?: string;
  sort_direction?: string;
}

export interface JobMatchQueryOptions {
  page?: number;
  page_size?: number;
  sort_by?: 'score' | 'name' | 'title' | 'experience';
  sort_direction?: 'asc' | 'desc';
}

export interface ModelInfoResponse {
  model_loaded: boolean;
  artifact_exists: boolean;
  model_path: string;
  autoload_enabled?: boolean;
  runtime_source: string;
  dataset_version?: string | null;
  trained_at_utc?: string | null;
  metrics?: Record<string, number>;
  canary_enabled?: boolean;
  canary_traffic_percent?: number;
  canary_model_path?: string;
  canary_model_exists?: boolean;
  promotion_gate_checked_at_utc?: string | null;
  promotion_gate_passed?: boolean | null;
  metric_gate_passed?: boolean | null;
  drift_gate_passed?: boolean | null;
  generalization_gate_passed?: boolean | null;
  robustness_gate_passed?: boolean | null;
  last_generalization_eval_at_utc?: string | null;
  last_generalization_scheduled_eval_at_utc?: string | null;
  last_generalization_gate_checked_at_utc?: string | null;
  last_generalization_gate_passed?: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class MatchingApiService {
  private readonly baseUrl = 'http://127.0.0.1:8000';

  constructor(private readonly http: HttpClient) {}

  getModelInfo(): Observable<ModelInfoResponse> {
    return this.http.get<ModelInfoResponse>(`${this.baseUrl}/ai/model-info`);
  }

  matchJob(payload: JobMatchRequest, options?: JobMatchQueryOptions): Observable<JobMatchResponse> {
    let params = new HttpParams();
    if (options?.page) params = params.set('page', options.page);
    if (options?.page_size) params = params.set('page_size', options.page_size);
    if (options?.sort_by) params = params.set('sort_by', options.sort_by);
    if (options?.sort_direction) params = params.set('sort_direction', options.sort_direction);
    return this.http.post<JobMatchResponse>(`${this.baseUrl}/match/job`, payload, { params });
  }
}
