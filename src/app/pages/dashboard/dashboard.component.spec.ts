import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { MatchingApiService } from '../../core/services/matching-api.service';
import { AuthApiService } from '../../core/services/auth-api.service';
import { JobsApiService } from '../../core/services/jobs-api.service';
import { CandidatesApiService } from '../../core/services/candidates-api.service';

describe('DashboardComponent', () => {
  let apiStub: { getModelInfo: ReturnType<typeof vi.fn> };
  let authStub: { getCurrentUserSnapshot: ReturnType<typeof vi.fn> };
  let jobsStub: { list: ReturnType<typeof vi.fn> };
  let candidatesStub: { listCandidates: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiStub = {
      getModelInfo: vi.fn(),
    };
    authStub = {
      getCurrentUserSnapshot: vi.fn().mockReturnValue({
        id: 1,
        email: 'admin@example.com',
        is_active: true,
        role: 'admin',
      }),
    };
    jobsStub = {
      list: vi.fn().mockReturnValue(of([])),
    };
    candidatesStub = {
      listCandidates: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: MatchingApiService, useValue: apiStub as unknown as MatchingApiService },
        { provide: AuthApiService, useValue: authStub as unknown as AuthApiService },
        { provide: JobsApiService, useValue: jobsStub as unknown as JobsApiService },
        { provide: CandidatesApiService, useValue: candidatesStub as unknown as CandidatesApiService },
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should load model info on init', () => {
    apiStub.getModelInfo.mockReturnValue(
      of({
        model_loaded: true,
        artifact_exists: true,
        model_path: 'artifacts/matcher.joblib',
        runtime_source: 'ml',
      }),
    );

    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;

    component.ngOnInit();

    expect(component.loading()).toBe(false);
    expect(component.errorKey()).toBe('');
    expect(component.info()?.model_loaded).toBe(true);
  });

  it('should set error key on load failure', () => {
    apiStub.getModelInfo.mockReturnValue(throwError(() => new Error('fail')));

    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.loading()).toBe(false);
    expect(component.errorKey()).toBe('dashboard.error.load');
  });

  it('should keep regular users on job-focused dashboard content', () => {
    authStub.getCurrentUserSnapshot.mockReturnValue({
      id: 2,
      email: 'user@example.com',
      is_active: true,
      role: 'user',
    });

    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(apiStub.getModelInfo).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect(component.canSeeModelHealth()).toBe(false);
    expect(component.quickActions()).toEqual([
      {
        labelKey: 'dashboard.action.jobs',
        descriptionKey: 'dashboard.action.jobsDesc',
        route: '/jobs',
        primary: true,
      },
    ]);
  });
});
