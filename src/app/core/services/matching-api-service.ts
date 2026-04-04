import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

export interface JobMatchRequest{
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
    ranked?: MatchCandidate[];
    candidates?: MatchCandidate[];
}

export interface ModelInfoResponse{
    model_loaded: boolean;
    artifact_exists: boolean;
    model_path: string;
    runtime_source: string;
    dataset_version?: string | null;
    trained_at_utc?: string | null;
    metrics?: Record<string, number>;
    canary_enabled?: boolean;
    canary_traffic_percent?: number;
    canary_model_path?: string;
    canary_model_exists?: boolean;
}

@Injectable({providedIn: 'root'})
export class MatchingApiService{
    private readonly baseUrl = 'http://127.0.0.1:8000';
    constructor(private http: HttpClient) {}
    getModelInfo(): Observable<ModelInfoResponse> {
        return this.http.get<ModelInfoResponse>('${this.baseUrl}/ai/model-info');
    }
        matchJob(payload: JobMatchRequest): Observable<JobMatchResponse> {
            return this.http.post<JobMatchResponse>('${this.baseUrl/match/job}', payload);
        }
    }
