import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { JobMatchRequest, MatchCandidate, MatchingApiService } from '../../core/services/matching-api.service';
import { TPipe } from '../../core/i18n/t.pipe';

type SortKey = 'name' | 'score' | 'title' | 'experience';
type SortDirection = 'asc' | 'desc';
type ColumnKey = 'name' | 'score' | 'title' | 'experience';

@Component({
  selector: 'app-matching',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TPipe],
  templateUrl: './matching.component.html',
})
export class MatchingComponent {
  loading = false;
  exporting = false;
  errorKey = '';
  results: MatchCandidate[] = [];
  hasSearched = false;
  lastPayload: JobMatchRequest | null = null;

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

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: MatchingApiService,
  ) {
    this.form = this.fb.nonNullable.group({
      job_title: ['', Validators.required],
      required_skills: ['python, sql', Validators.required],
      min_experience: [0, [Validators.required, Validators.min(0)]],
      limit: [50, [Validators.required, Validators.min(1), Validators.max(2000)]],
    });
  }

  submit(): void {
    if (this.form.invalid) return;

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

    this.lastPayload = payload;
    this.currentPage = 1;
    this.runMatch(payload);
  }

  retry(): void {
    if (!this.lastPayload) return;
    this.runMatch(this.lastPayload);
  }

  onSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = key === 'score' ? 'desc' : 'asc';
    }
    this.currentPage = 1;
    if (this.lastPayload) {
      this.runMatch(this.lastPayload);
    }
  }

  sortIndicator(key: SortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDirection === 'asc' ? '^' : 'v';
  }

  get showEmptyState(): boolean {
    return this.hasSearched && !this.loading && !this.errorKey && this.totalResults === 0;
  }

  onPageSizeChange(sizeRaw: string): void {
    const parsed = Number(sizeRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    this.pageSize = parsed;
    this.currentPage = 1;
    if (this.lastPayload) {
      this.runMatch(this.lastPayload);
    }
  }

  prevPage(): void {
    if (!this.hasPrev || !this.lastPayload) return;
    this.currentPage -= 1;
    this.runMatch(this.lastPayload);
  }

  nextPage(): void {
    if (!this.hasNext || !this.lastPayload) return;
    this.currentPage += 1;
    this.runMatch(this.lastPayload);
  }

  toggleColumn(column: ColumnKey): void {
    const currentlyEnabled = this.visibleColumns[column];
    if (currentlyEnabled) {
      const enabledCount = Object.values(this.visibleColumns).filter(Boolean).length;
      if (enabledCount <= 1) return;
    }
    this.visibleColumns[column] = !currentlyEnabled;
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
    const fallback = candidate.score ?? 0;
    return fallback * 100;
  }

  scoreChipClass(candidate: MatchCandidate): string {
    const score = this.scorePercent(candidate);
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-red-100 text-red-800 border-red-200';
  }

  private runMatch(payload: JobMatchRequest): void {
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
      })
      .subscribe({
        next: (res) => {
          this.results = res.results ?? res.ranked ?? res.candidates ?? [];
          this.totalResults = Number(res.total_results ?? this.results.length);
          this.totalPages = Number(res.total_pages ?? 1);
          this.currentPage = Number(res.page ?? this.currentPage);
          this.pageSize = Number(res.page_size ?? this.pageSize);
          this.hasNext = Boolean(res.has_next ?? false);
          this.hasPrev = Boolean(res.has_prev ?? false);
          this.loading = false;
        },
        error: () => {
          this.errorKey = 'matching.error.request';
          this.totalResults = 0;
          this.totalPages = 1;
          this.hasNext = false;
          this.hasPrev = false;
          this.loading = false;
        },
      });
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
