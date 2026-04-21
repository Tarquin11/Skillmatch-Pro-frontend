import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CandidateSkillExtraction {
  skill: string;
  confidence: number;
  confidence_normalized: number;
  source: string;
  source_label?: string | null;
  confidence_band?: 'low' | 'medium' | 'high' | null;
  evidence: string[];
}

export interface CandidateSkillHierarchyNode {
  parent: string;
  subskills: string[];
}

export interface CandidateSkillGraphNode {
  children: string[];
  confidence: number;
}

export interface CandidateLanguageExtraction {
  language: string;
  level: string | null;
  source: string | null;
}

export interface CandidateExtractionChannels {
  catalog_match: string[];
  open_vocab: string[];
  soft_skill: string[];
  sentence: string[];
  semantic_augment: string[];
  language: string[];
  project_text: string[];
}

export interface CandidateUploadResponse {
  filename: string;
  ok: boolean;
  degraded: boolean;
  errors: string[];
  warnings: string[];
  text_length: number;
  skills: string[];
  skills_grouped: Record<string, string[]>;
  skill_hierarchy: CandidateSkillHierarchyNode[];
  skill_graph: Record<string, CandidateSkillGraphNode>;
  extracted_languages: string[];
  language_details: CandidateLanguageExtraction[];
  extraction_channels: CandidateExtractionChannels;
  preview: string;
  extracted_skills: CandidateSkillExtraction[];
  extracted_full_name: string | null;
  extracted_email: string | null;
  extracted_phone: string | null;
  predicted_title: string | null;
  predicted_experience_years: number | null;
}

export interface CandidateProfile {
  id: number;
  employee_number: string;
  full_name: string;
  email: string;
  phone: string | null;
  predicted_title: string | null;
  predicted_experience_years: number | null;
  skills: string[];
  uploaded_at: string | null;
}

export interface CandidateUpdatePayload {
  full_name?: string;
  employee_number?: string;
  skills?: string[];
}

export interface CandidateListQuery {
  skip?: number;
  limit?: number;
  search?: string;
  sort_by?: 'id' | 'name' | 'email' | 'title' | 'uploaded_at';
  sort_dir?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class CandidatesApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  uploadCv(file: File): Observable<HttpEvent<CandidateUploadResponse>> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<CandidateUploadResponse>(`${this.baseUrl}/candidates/upload_cv`, formData, {
      reportProgress: true,
      observe: 'events',
    });
  }

  listCandidates(query?: CandidateListQuery): Observable<CandidateProfile[]> {
    let params = new HttpParams();
    if (query?.skip !== undefined) params = params.set('skip', query.skip);
    if (query?.limit !== undefined) params = params.set('limit', query.limit);
    if (query?.search) params = params.set('search', query.search);
    if (query?.sort_by) params = params.set('sort_by', query.sort_by);
    if (query?.sort_dir) params = params.set('sort_dir', query.sort_dir);
    return this.http.get<CandidateProfile[]>(`${this.baseUrl}/candidates/`, { params });
  }

  updateCandidate(candidateId: number, payload: CandidateUpdatePayload): Observable<CandidateProfile> {
    return this.http.patch<CandidateProfile>(`${this.baseUrl}/candidates/${candidateId}`, payload);
  }

  deleteCandidate(candidateId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/candidates/${candidateId}`);
  }
}
