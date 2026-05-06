import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatchingApiService, ModelInfoResponse } from '../../core/services/matching-api.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../core/components/ui/empty-state/empty-state.component';
import { AuthApiService, UserRole } from '../../core/services/auth-api.service';
import { JobsApiService } from '../../core/services/jobs-api.service';
import { CandidatesApiService } from '../../core/services/candidates-api.service';

type TriState = boolean | null | undefined;
type DashboardRole = UserRole | 'unknown';
type HealthState = 'healthy' | 'attention' | 'unavailable';

interface DashboardAction {
  labelKey: string;
  descriptionKey: string;
  route: string;
  primary?: boolean;
}

interface DashboardMetric {
  key: string;
  label: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TPipe, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  readonly loading = signal(true);
  readonly errorKey = signal('');
  readonly info = signal<ModelInfoResponse | null>(null);
  readonly currentRole = signal<DashboardRole>('unknown');
  readonly jobsCount = signal<number | null>(null);
  readonly candidatesCount = signal<number | null>(null);
  readonly updatedAt = signal<string>('');

  readonly metrics: DashboardMetric[] = [
    { key: 'roc_auc', label: 'ROC-AUC' },
    { key: 'f1', label: 'F1' },
    { key: 'map_at_k', label: 'MAP@K' },
    { key: 'precision_at_k', label: 'Precision@K' },
    { key: 'recall_at_k', label: 'Recall@K' },
  ];

  constructor(
    private readonly api: MatchingApiService,
    private readonly auth: AuthApiService,
    private readonly jobsApi: JobsApiService,
    private readonly candidatesApi: CandidatesApiService,
  ) {}

  ngOnInit(): void {
    const role = this.auth.getCurrentUserSnapshot()?.role ?? 'unknown';
    this.currentRole.set(role);
    this.updatedAt.set(new Date().toISOString());
    this.loadJobsCount();
    if (role === 'admin') {
      this.loadCandidatesCount();
    }
    if (this.canSeeModelHealth()) {
      this.loadModelInfo();
      return;
    }
    this.loading.set(false);
  }

  titleKey(): string {
    if (this.currentRole() === 'recruiter') return 'dashboard.recruiterTitle';
    if (this.currentRole() === 'user') return 'dashboard.userTitle';
    return 'dashboard.title';
  }

  subtitleKey(): string {
    if (this.currentRole() === 'recruiter') return 'dashboard.recruiterSubtitle';
    if (this.currentRole() === 'user') return 'dashboard.userSubtitle';
    return 'dashboard.subtitle';
  }

  roleLabelKey(): string {
    if (this.currentRole() === 'unknown') return 'dashboard.role.unknown';
    return `adminUsers.role.${this.currentRole()}`;
  }

  quickActions(): DashboardAction[] {
    const role = this.currentRole();
    if (role === 'admin') {
      return [
        {
          labelKey: 'dashboard.action.users',
          descriptionKey: 'dashboard.action.usersDesc',
          route: '/admin/users',
          primary: true,
        },
        {
          labelKey: 'dashboard.action.learning',
          descriptionKey: 'dashboard.action.learningDesc',
          route: '/admin/learning',
        },
        {
          labelKey: 'dashboard.action.uploadCv',
          descriptionKey: 'dashboard.action.uploadCvDesc',
          route: '/cv-upload',
        },
        {
          labelKey: 'dashboard.action.matching',
          descriptionKey: 'dashboard.action.matchingDesc',
          route: '/matching',
        },
        {
          labelKey: 'dashboard.action.jobs',
          descriptionKey: 'dashboard.action.jobsDesc',
          route: '/jobs',
        },
      ];
    }
    if (role === 'recruiter') {
      return [
        {
          labelKey: 'dashboard.action.uploadCv',
          descriptionKey: 'dashboard.action.uploadCvDesc',
          route: '/cv-upload',
          primary: true,
        },
        {
          labelKey: 'dashboard.action.matching',
          descriptionKey: 'dashboard.action.matchingDesc',
          route: '/matching',
        },
        {
          labelKey: 'dashboard.action.jobs',
          descriptionKey: 'dashboard.action.jobsDesc',
          route: '/jobs',
        },
      ];
    }
    return [
      {
        labelKey: 'dashboard.action.jobs',
        descriptionKey: 'dashboard.action.jobsDesc',
        route: '/jobs',
        primary: true,
      },
    ];
  }

  canSeeModelHealth(): boolean {
    return this.currentRole() === 'admin' || this.currentRole() === 'recruiter';
  }

  isAdmin(): boolean {
    return this.currentRole() === 'admin';
  }

  healthState(info: ModelInfoResponse | null = this.info()): HealthState {
    if (!info || !info.model_loaded || !info.artifact_exists) return 'unavailable';
    if (
      info.promotion_gate_passed === false ||
      info.metric_gate_passed === false ||
      info.drift_gate_passed === false ||
      info.generalization_gate_passed === false ||
      info.robustness_gate_passed === false
    ) {
      return 'attention';
    }
    return 'healthy';
  }

  healthTitleKey(): string {
    return `dashboard.health.${this.healthState()}.title`;
  }

  healthSubtitleKey(): string {
    return `dashboard.health.${this.healthState()}.subtitle`;
  }

  healthClass(): string {
    const state = this.healthState();
    if (state === 'healthy') return 'border-green-200 bg-green-50 text-green-800';
    if (state === 'attention') return 'border-amber-200 bg-amber-50 text-amber-800';
    return 'border-red-200 bg-red-50 text-red-800';
  }

  statusLabelKey(status: TriState, trueKey: string, falseKey: string): string {
    if (status === true) return trueKey;
    if (status === false) return falseKey;
    return 'dashboard.badge.unknown';
  }

  statusTextKey(status: TriState): string {
    if (status === true) return 'dashboard.badge.pass';
    if (status === false) return 'dashboard.badge.fail';
    return 'dashboard.badge.unknown';
  }

  statusBadgeClass(status: TriState): string {
    if (status === true) return 'bg-green-100 text-green-800 border-green-200';
    if (status === false) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }

  formatTimestamp(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  datasetVersion(info: ModelInfoResponse): string {
    const raw = String(info.dataset_version ?? '').trim();
    if (!raw || raw.toLowerCase().includes('didnt put')) return '';
    return raw;
  }

  metricValue(key: string): string {
    const raw = this.info()?.metrics?.[key];
    if (raw === undefined || raw === null || Number.isNaN(raw)) return 'N/A';
    return raw.toFixed(3);
  }

  metricPercent(key: string): number {
    const raw = this.info()?.metrics?.[key];
    if (raw === undefined || raw === null || Number.isNaN(raw)) return 0;
    return Math.max(0, Math.min(100, raw * 100));
  }

  metricBarClass(key: string): string {
    const raw = this.info()?.metrics?.[key] ?? 0;
    if (raw >= 0.85) return 'bg-green-500';
    if (raw >= 0.7) return 'bg-amber-500';
    return 'bg-red-500';
  }

  private loadModelInfo(): void {
    this.loading.set(true);
    this.api.getModelInfo().subscribe({
      next: (res) => {
        this.info.set(res);
        this.updatedAt.set(new Date().toISOString());
        this.loading.set(false);
      },
      error: () => {
        this.errorKey.set('dashboard.error.load');
        this.loading.set(false);
      },
    });
  }

  private loadJobsCount(): void {
    this.jobsApi.list({ limit: 100, sort_by: 'id', sort_dir: 'desc' }).subscribe({
      next: (jobs) => {
        this.jobsCount.set(jobs.length);
        this.updatedAt.set(new Date().toISOString());
      },
      error: () => {
        this.jobsCount.set(null);
      },
    });
  }

  private loadCandidatesCount(): void {
    this.candidatesApi.listCandidates({ limit: 100, sort_by: 'uploaded_at', sort_dir: 'desc' }).subscribe({
      next: (candidates) => {
        this.candidatesCount.set(candidates.length);
        this.updatedAt.set(new Date().toISOString());
      },
      error: () => {
        this.candidatesCount.set(null);
      },
    });
  }
}
