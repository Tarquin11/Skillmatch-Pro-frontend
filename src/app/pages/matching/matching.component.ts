import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { JobMatchRequest, MatchCandidate, MatchingApiService } from '../../core/services/matching-api.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { FormFieldComponent } from '../../core/components/ui/form-field/form-field.component';
import { DataTableComponent } from '../../core/components/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../core/components/ui/empty-state/empty-state.component';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { UxTelemetryService } from '../../core/services/ux-telemetry.service';

type SortKey = 'name' | 'score' | 'title' | 'experience';
type SortDirection = 'asc' | 'desc';
type ColumnKey = 'name' | 'score' | 'title' | 'experience';
type MatchCandidateScope = 'all' | 'candidates';
type ExplainabilityComponent = {
  feature: string;
  labelKey: string;
  contribution: number;
  sharePercent: number;
  positive: boolean;
};
const MATCHING_PREF_KEY = 'matching_results';

@Component({
  selector: 'app-matching',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TPipe,
    PageHeaderComponent,
    FormFieldComponent,
    DataTableComponent,
    EmptyStateComponent,
  ],
  templateUrl: './matching.component.html',
})
export class MatchingComponent implements OnDestroy {
  loading = false;
  exporting = false;
  errorKey = '';
  results: MatchCandidate[] = [];
  hasSearched = false;
  lastPayload: JobMatchRequest | null = null;
  lastCandidateScope: MatchCandidateScope = 'all';
  selectedCandidate: MatchCandidate | null = null;

  sortKey: SortKey = 'score';
  sortDirection: SortDirection = 'desc';

  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = [10, 25, 50];
  totalResults = 0;
  totalPages = 1;
  hasNext = false;
  hasPrev = false;

  visibleColumns: Record<ColumnKey, boolean> = {
    name: true,
    score: true,
    title: true,
    experience: true,
  };

  form;
  private hasSubmittedMatch = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: MatchingApiService,
    private readonly preferences: UserPreferencesService,
    private readonly telemetry: UxTelemetryService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.nonNullable.group({
      job_title: ['', Validators.required],
      required_skills: ['python, sql', Validators.required],
      candidate_scope: ['all' as MatchCandidateScope, Validators.required],
      min_experience: [0, [Validators.required, Validators.min(0)]],
      limit: [50, [Validators.required, Validators.min(1), Validators.max(2000)]],
    });
    this.restorePreferences();
    this.enforceScoreSortDirection();
  }

  submit(): void {
    if (this.form.invalid) {
      this.telemetry.track('matching_search_invalid_form', {
        invalid_controls: Object.entries(this.form.controls)
          .filter(([, control]) => control.invalid)
          .map(([name]) => name),
      });
      return;
    }

    const rawSkills = this.form.getRawValue().required_skills;
    const requiredSkills = rawSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: JobMatchRequest = {
      job_title: this.form.value.job_title ?? '',
      required_skills: requiredSkills,
      min_experience: Number(this.form.value.min_experience),
      limit: Number(this.form.value.limit),
    };
    const candidateScope = (this.form.value.candidate_scope ?? 'all') as MatchCandidateScope;

    this.hasSubmittedMatch = true;
    this.telemetry.track('matching_search_used', {
      required_skills_count: requiredSkills.length,
      min_experience: payload.min_experience,
      limit: payload.limit,
      candidate_scope: candidateScope,
    });

    this.lastPayload = payload;
    this.lastCandidateScope = candidateScope;
    this.currentPage = 1;
    this.runMatch(payload, candidateScope);
  }

  retry(): void {
    if (!this.lastPayload) return;
    this.telemetry.track('matching_retry_clicked', {
      current_page: this.currentPage,
      page_size: this.pageSize,
      sort_key: this.sortKey,
      sort_direction: this.sortDirection,
      candidate_scope: this.lastCandidateScope,
    });
    this.runMatch(this.lastPayload, this.lastCandidateScope);
  }

  ngOnDestroy(): void {
    if (this.form.dirty && !this.hasSubmittedMatch) {
      this.telemetry.track('matching_form_abandoned', {
        job_title_touched: this.form.controls.job_title.dirty,
        required_skills_touched: this.form.controls.required_skills.dirty,
        min_experience_touched: this.form.controls.min_experience.dirty,
        limit_touched: this.form.controls.limit.dirty,
      });
    }
  }

  onSort(key: SortKey): void {
    if (key === 'score') {
      this.sortKey = 'score';
      this.sortDirection = 'desc';
    } else if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    this.persistSortPreference();
    this.currentPage = 1;
    if (this.lastPayload) {
      this.runMatch(this.lastPayload, this.lastCandidateScope);
    }
  }

  sortIndicator(key: SortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDirection === 'asc' ? '^' : 'v';
  }

  ariaSort(key: SortKey): 'none' | 'ascending' | 'descending' {
    if (this.sortKey !== key) return 'none';
    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  get showEmptyState(): boolean {
    return this.hasSearched && !this.loading && !this.errorKey && this.totalResults === 0;
  }

  onPageSizeChange(sizeRaw: string): void {
    const parsed = Number(sizeRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    this.pageSize = parsed;
    this.persistPageSizePreference();
    this.currentPage = 1;
    if (this.lastPayload) {
      this.runMatch(this.lastPayload, this.lastCandidateScope);
    }
  }

  prevPage(): void {
    if (!this.hasPrev || !this.lastPayload) return;
    this.currentPage -= 1;
    this.runMatch(this.lastPayload, this.lastCandidateScope);
  }

  nextPage(): void {
    if (!this.hasNext || !this.lastPayload) return;
    this.currentPage += 1;
    this.runMatch(this.lastPayload, this.lastCandidateScope);
  }

  toggleColumn(column: ColumnKey): void {
    const currentlyEnabled = this.visibleColumns[column];
    if (currentlyEnabled) {
      const enabledCount = Object.values(this.visibleColumns).filter(Boolean).length;
      if (enabledCount <= 1) return;
    }
    this.visibleColumns[column] = !currentlyEnabled;
    this.persistVisibleColumnsPreference();
  }

  isVisible(column: ColumnKey): boolean {
    return this.visibleColumns[column];
  }

  exportCsv(): void {
    if (!this.lastPayload || this.totalResults === 0 || this.exporting) return;
    this.exporting = true;

    const fullSize = Math.max(1, Math.min(this.lastPayload.limit, this.totalResults));
    this.api
      .matchJob(this.lastPayload, {
        page: 1,
        page_size: fullSize,
        sort_by: this.sortKey,
        sort_direction: this.sortDirection,
        candidate_scope: this.lastCandidateScope,
      })
      .subscribe({
        next: (res) => {
          const rows = res.results ?? res.ranked ?? res.candidates ?? [];
          this.downloadCsv(rows);
          this.exporting = false;
        },
        error: () => {
          this.errorKey = 'matching.error.request';
          this.exporting = false;
        },
      });
  }

  scorePercent(candidate: MatchCandidate): number {
    const raw = candidate.score_percent;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    const fallback = candidate.score ?? candidate.predicted_fit_score ?? 0;
    if (!Number.isFinite(fallback)) return 0;
    return fallback <= 1 ? fallback * 100 : fallback;
  }

  scoreChipClass(candidate: MatchCandidate): string {
    const score = this.scorePercent(candidate);
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-red-100 text-red-800 border-red-200';
  }

  selectCandidate(candidate: MatchCandidate): void {
    this.selectedCandidate = candidate;
  }

  clearSelection(): void {
    this.selectedCandidate = null;
  }

  selectedCandidateName(): string {
    if (!this.selectedCandidate) return '';
    return this.selectedCandidate.full_name || `#${this.selectedCandidate.employee_id ?? 'N/A'}`;
  }

  requiredSkills(): string[] {
    return this.lastPayload?.required_skills ?? [];
  }

  skillCoverage(candidate: MatchCandidate): { matched: number; total: number; ratio: number } {
    const total = this.requiredSkills().length;
    const matched = (candidate.matched_skills ?? []).length;
    if (total <= 0) {
      return { matched, total: 0, ratio: 1 };
    }
    return {
      matched,
      total,
      ratio: Math.max(0, Math.min(1, matched / total)),
    };
  }

  meetsExperience(candidate: MatchCandidate): boolean | null {
    const minRequired = this.lastPayload?.min_experience;
    const predicted = candidate.predicted_experience_years;
    if (minRequired === undefined || minRequired === null) return null;
    if (predicted === undefined || predicted === null || Number.isNaN(predicted)) return null;
    return predicted >= minRequired;
  }

  explainabilityComponents(candidate: MatchCandidate): ExplainabilityComponent[] {
    const breakdown = candidate.feature_breakdown ?? {};
    const entries = Object.entries(breakdown).filter(([, value]) => Number.isFinite(value));
    if (!entries.length) return [];

    const totalAbs = entries.reduce((sum, [, value]) => sum + Math.abs(value), 0) || 1;
    return entries
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 6)
      .map(([feature, contribution]) => ({
        feature,
        labelKey: this.featureLabelKey(feature),
        contribution,
        sharePercent: Math.round((Math.abs(contribution) / totalAbs) * 100),
        positive: contribution >= 0,
      }));
  }

  featureLabelKey(feature: string): string {
    switch (feature) {
      case 'skill_overlap':
        return 'matching.explain.feature.skill_overlap';
      case 'missing_skill_ratio':
        return 'matching.explain.feature.missing_skill_ratio';
      case 'experience_score':
        return 'matching.explain.feature.experience_score';
      case 'experience_surplus':
        return 'matching.explain.feature.experience_surplus';
      case 'experience_gap':
        return 'matching.explain.feature.experience_gap';
      case 'semantic_similarity':
        return 'matching.explain.feature.semantic_similarity';
      case 'performance_score':
        return 'matching.explain.feature.performance_score';
      case 'engagement_score':
        return 'matching.explain.feature.engagement_score';
      case 'satisfaction_score':
        return 'matching.explain.feature.satisfaction_score';
      case 'hands_on_projects':
        return 'matching.explain.feature.hands_on_projects';
      case 'currently_active':
        return 'matching.explain.feature.currently_active';
      default:
        return feature.replace(/_/g, ' ');
    }
  }

  private runMatch(payload: JobMatchRequest, scope: MatchCandidateScope = this.lastCandidateScope): void {
    this.enforceScoreSortDirection();
    this.loading = true;
    this.errorKey = '';
    this.results = [];
    this.hasSearched = true;

    this.api
      .matchJob(payload, {
        page: this.currentPage,
        page_size: this.pageSize,
        sort_by: this.sortKey,
        sort_direction: this.sortDirection,
        candidate_scope: scope,
      })
      .subscribe({
        next: (res) => {
          const rows = res.results ?? res.ranked ?? res.candidates ?? [];
          this.results = this.sortRowsForDisplay(rows);
          if (this.selectedCandidate?.employee_id !== undefined) {
            this.selectedCandidate =
              this.results.find((row) => row.employee_id === this.selectedCandidate?.employee_id) ?? null;
          }
          this.totalResults = Number(res.total_results ?? this.results.length);
          this.totalPages = Number(res.total_pages ?? 1);
          this.currentPage = Number(res.page ?? this.currentPage);
          this.pageSize = Number(res.page_size ?? this.pageSize);
          this.persistPageSizePreference();
          this.hasNext = Boolean(res.has_next ?? false);
          this.hasPrev = Boolean(res.has_prev ?? false);
          this.loading = false;
          try {
            this.cdr.detectChanges();
          } catch {
            // ignore
          }
        },
        error: () => {
          this.errorKey = 'matching.error.request';
          this.selectedCandidate = null;
          this.totalResults = 0;
          this.totalPages = 1;
          this.hasNext = false;
          this.hasPrev = false;
          this.loading = false;
        },
      });
  }

  private restorePreferences(): void {
    const pref = this.preferences.getTablePreference<SortKey, ColumnKey>(MATCHING_PREF_KEY);

    if (this.isPageSizeOption(pref.pageSize)) {
      this.pageSize = pref.pageSize;
    }

    if (pref.sort && this.isSortKey(pref.sort.key)) {
      this.sortKey = pref.sort.key;
      this.sortDirection = pref.sort.direction === 'asc' ? 'asc' : 'desc';
    }

    if (pref.visibleColumns) {
      const next: Record<ColumnKey, boolean> = { ...this.visibleColumns };
      let enabledCount = 0;

      (Object.keys(next) as ColumnKey[]).forEach((key) => {
        const rawValue = pref.visibleColumns?.[key];
        if (typeof rawValue === 'boolean') {
          next[key] = rawValue;
        }
        if (next[key]) {
          enabledCount += 1;
        }
      });

      if (enabledCount > 0) {
        this.visibleColumns = next;
      }
    }
  }

  private enforceScoreSortDirection(): void {
    if (this.sortKey !== 'score' || this.sortDirection === 'desc') {
      return;
    }
    this.sortDirection = 'desc';
    this.persistSortPreference();
  }

  private sortRowsForDisplay(rows: MatchCandidate[]): MatchCandidate[] {
    if (this.sortKey !== 'score') {
      return rows;
    }
    return [...rows].sort((a, b) => this.scorePercent(b) - this.scorePercent(a));
  }

  private persistPageSizePreference(): void {
    this.preferences.setTablePageSize(MATCHING_PREF_KEY, this.pageSize);
  }

  private persistSortPreference(): void {
    this.preferences.setTableSort(MATCHING_PREF_KEY, {
      key: this.sortKey,
      direction: this.sortDirection,
    });
  }

  private persistVisibleColumnsPreference(): void {
    this.preferences.setTableVisibleColumns(MATCHING_PREF_KEY, this.visibleColumns);
  }

  private isPageSizeOption(value: number | undefined): value is number {
    return typeof value === 'number' && this.pageSizeOptions.includes(value);
  }

  private isSortKey(value: string): value is SortKey {
    return value === 'name' || value === 'score' || value === 'title' || value === 'experience';
  }

  private downloadCsv(rows: MatchCandidate[]): void {
    const allColumns: Array<{ key: ColumnKey; header: string }> = [
      { key: 'name', header: 'full_name' },
      { key: 'score', header: 'score_percent' },
      { key: 'title', header: 'predicted_title' },
      { key: 'experience', header: 'predicted_experience_years' },
    ];
    const columns = allColumns.filter((col) => this.visibleColumns[col.key]);

    const headers = ['employee_id', ...columns.map((c) => c.header)];
    const bodyRows = rows.map((c) => {
      const base = [c.employee_id ?? ''];
      const extras = columns.map((col) => {
        if (col.key === 'name') return c.full_name ?? '';
        if (col.key === 'score') return this.scorePercent(c).toFixed(2);
        if (col.key === 'title') return c.predicted_title ?? '';
        return c.predicted_experience_years ?? '';
      });
      return [...base, ...extras];
    });

    const csv = [headers, ...bodyRows]
      .map((row) => row.map((cell) => this.escapeCsvValue(cell)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const title = (this.form.value.job_title ?? 'job').trim().replace(/\s+/g, '_').toLowerCase() || 'job';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `matching_${title}_${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private escapeCsvValue(value: unknown): string {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
