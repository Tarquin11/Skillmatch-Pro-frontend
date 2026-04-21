import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatchingApiService } from './matching-api.service';

describe('MatchingApiService', () => {
  let service: MatchingApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MatchingApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MatchingApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should call GET /ai/model-info', () => {
    service.getModelInfo().subscribe();

    const req = httpMock.expectOne('https://localhost:8000/ai/model-info');
    expect(req.request.method).toBe('GET');
    req.flush({
      model_loaded: true,
      artifact_exists: true,
      model_path: 'artifacts/matcher.joblib',
      runtime_source: 'ml',
    });
  });

  it('should call POST /match/job with pagination and sort params', () => {
    service
      .matchJob(
        {
          job_title: 'Data Analyst',
          required_skills: ['python', 'sql'],
          min_experience: 0,
          limit: 10,
        },
        {
          page: 2,
          page_size: 25,
          sort_by: 'score',
          sort_direction: 'desc',
        },
      )
      .subscribe();

    const req = httpMock.expectOne((r) => r.url === 'https://localhost:8000/match/job');
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('25');
    expect(req.request.params.get('sort_by')).toBe('score');
    expect(req.request.params.get('sort_direction')).toBe('desc');
    req.flush({ results: [] });
  });
});
