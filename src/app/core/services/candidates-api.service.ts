import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CandidateSkillExtraction {
  skill: string;
  confidence: number;
  source: string;
}

export interface CandidateUploadResponse {
  filename: string;
  ok: boolean;
  degraded: boolean;
  errors: string[];
  warnings: string[];
  text_length: number;
  skills: string[];
  preview: string;
  extracted_skills: CandidateSkillExtraction[];
  predicted_title: string | null;
  predicted_experience_years: number | null;
}

@Injectable({ providedIn: 'root' })
export class CandidatesApiService {
  private readonly baseUrl = 'http://127.0.0.1:8000';

  constructor(private readonly http: HttpClient) {}

  uploadCv(file: File): Observable<HttpEvent<CandidateUploadResponse>> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<CandidateUploadResponse>(`${this.baseUrl}/candidates/upload_cv`, formData, {
      observe: 'events',
      reportProgress: true,
    });
  }
}
