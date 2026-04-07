import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { MatchingApiService } from '../../core/services/matching-api.service';

describe('DashboardComponent', () => {
  let apiStub: { getModelInfo: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiStub = {
      getModelInfo: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: MatchingApiService, useValue: apiStub as unknown as MatchingApiService }],
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
});
