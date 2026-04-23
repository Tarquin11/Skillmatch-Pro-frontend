import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type LearningEntityType = 'skill' | 'project' | 'certification' | 'unknown';
export type LearningDecision = 'approved' | 'rejected';
export type LearningStatus = 'pending' | 'approved' | 'rejected';

export interface EntityReview {
  id: number;
  unknown_entity_id: number;
  reviewer_id: number;
  decision: LearningDecision;
  entity_type: LearningEntityType;
  canonical_value: string | null;
  notes: string | null;
  promoted_skill_id: number | null;
  created_at: string | null;
}

export interface UnknownEntity {
  id: number;
  raw_value: string;
  normalized_value: string;
  entity_type_guess: LearningEntityType;
  resolved_entity_type: LearningEntityType | null;
  status: LearningStatus;
  source: string | null;
  confidence: number | null;
  confidence_band: 'low' | 'medium' | 'high' | null;
  evidence: string[];
  context_excerpt: string | null;
  occurrence_count: number;
  candidate_id: number | null;
  canonical_skill_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  reviews: EntityReview[];
}

export interface UnknownEntityListQuery {
  skip?: number;
  limit?: number;
  status?: LearningStatus;
  entity_type?: LearningEntityType;
  search?: string;
  include_reviews?: boolean;
}

export interface ReviewUnknownEntityPayload {
  decision: LearningDecision;
  entity_type: LearningEntityType;
  canonical_value?: string | null;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class LearningApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  listUnknownEntities(query?: UnknownEntityListQuery): Observable<UnknownEntity[]> {
    let params = new HttpParams();
    if (query?.skip !== undefined) params = params.set('skip', query.skip);
    if (query?.limit !== undefined) params = params.set('limit', query.limit);
    if (query?.status) params = params.set('status', query.status);
    if (query?.entity_type) params = params.set('entity_type', query.entity_type);
    if (query?.search) params = params.set('search', query.search);
    if (query?.include_reviews !== undefined) params = params.set('include_reviews', String(query.include_reviews));

    return this.http.get<UnknownEntity[]>(`${this.baseUrl}/learning/unknown-entities`, { params });
  }

  getUnknownEntity(entityId: number): Observable<UnknownEntity> {
    return this.http.get<UnknownEntity>(`${this.baseUrl}/learning/unknown-entities/${entityId}`);
  }

  reviewUnknownEntity(entityId: number, payload: ReviewUnknownEntityPayload): Observable<UnknownEntity> {
    return this.http.post<UnknownEntity>(`${this.baseUrl}/learning/unknown-entities/${entityId}/review`, payload);
  }
}
