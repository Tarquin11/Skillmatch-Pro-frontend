import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { CandidateProfile, CandidatesApiService } from '../../core/services/candidates-api.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { DataTableComponent } from '../../core/components/ui/data-table/data-table.component';
import { ConfirmDialogComponent } from '../../core/components/ui/confirm-dialog/confirm-dialog.component';

type CandidateSortKey = 'id' | 'name' | 'email' | 'title' | 'uploaded_at';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, TPipe, PageHeaderComponent, DataTableComponent, ConfirmDialogComponent],
  templateUrl: './candidates.component.html',
})
export class CandidatesComponent implements OnInit {
  loading = true;
  deletingId: number | null = null;

  errorMessage = '';
  actionErrorMessage = '';
  successKey = '';

  candidates: CandidateProfile[] = [];
  selectedViewCandidateId: number | null = null;
  deleteTarget: CandidateProfile | null = null;

  currentPage = 1;
  pageSize = 20;
  readonly pageSizeOptions = [10, 20, 50];
  hasPrev = false;
  hasNext = false;

  search = '';
  sortKey: CandidateSortKey = 'uploaded_at';
  sortDirection: SortDirection = 'desc';

  constructor(
    private readonly api: CandidatesApiService,
    private readonly apiErrorService: ApiErrorService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadCandidates();
  }

  applySearch(value: string): void {
    this.search = value.trim();
    this.currentPage = 1;
    this.loadCandidates();
  }

  onSort(key: CandidateSortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = key === 'uploaded_at' ? 'desc' : 'asc';
    }
    this.currentPage = 1;
    this.loadCandidates();
  }

  sortIndicator(key: CandidateSortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDirection === 'asc' ? '^' : 'v';
  }

  ariaSort(key: CandidateSortKey): 'none' | 'ascending' | 'descending' {
    if (this.sortKey !== key) return 'none';
    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  prevPage(): void {
    if (!this.hasPrev || this.loading) return;
    this.currentPage -= 1;
    this.loadCandidates();
  }

  nextPage(): void {
    if (!this.hasNext || this.loading) return;
    this.currentPage += 1;
    this.loadCandidates();
  }

  onPageSizeChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    this.pageSize = parsed;
    this.currentPage = 1;
    this.loadCandidates();
  }

  skillsPreview(row: CandidateProfile): string {
    const skills = row.skills ?? [];
    if (!skills.length) return 'N/A';
    const preview = skills.slice(0, 3).join(', ');
    return skills.length > 3 ? `${preview} ...` : preview;
  }

  skillsCount(row: CandidateProfile): number {
    return Array.isArray(row.skills) ? row.skills.length : 0;
  }

  startViewSkills(row: CandidateProfile): void {
    this.successKey = '';
    this.actionErrorMessage = '';
    if (this.selectedViewCandidateId === row.id) {
      this.selectedViewCandidateId = null;
      return;
    }
    this.selectedViewCandidateId = row.id;
  }

  isViewing(row: CandidateProfile): boolean {
    return this.selectedViewCandidateId === row.id;
  }

  selectedViewCandidate(): CandidateProfile | null {
    if (this.selectedViewCandidateId === null) return null;
    return this.candidates.find((row) => row.id === this.selectedViewCandidateId) ?? null;
  }

  closeViewSkills(): void {
    this.selectedViewCandidateId = null;
  }

  requestDeleteCandidate(row: CandidateProfile): void {
    if (!row.id || this.deletingId !== null) return;
    this.successKey = '';
    this.actionErrorMessage = '';
    this.deleteTarget = row;
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  confirmDeleteCandidate(): void {
    const target = this.deleteTarget;
    if (!target?.id || this.deletingId !== null) return;

    this.deletingId = target.id;
    this.deleteTarget = null;
    this.successKey = '';
    this.actionErrorMessage = '';

    this.api
      .deleteCandidate(target.id)
      .pipe(finalize(() => (this.deletingId = null)))
      .subscribe({
        next: () => {
          if (this.selectedViewCandidateId === target.id) {
            this.selectedViewCandidateId = null;
          }
          this.successKey = 'candidates.delete.success';
          if (this.candidates.length <= 1 && this.currentPage > 1) {
            this.currentPage -= 1;
          }
          this.loadCandidates();
        },
        error: (err: unknown) => {
          const normalized = this.apiErrorService.normalize(err);
          this.actionErrorMessage = normalized.i18nKey || normalized.message || 'candidates.delete.error';
        },
      });
  }

  private loadCandidates(): void {
    this.loading = true;
    this.errorMessage = '';

    this.api
      .listCandidates({
        skip: (this.currentPage - 1) * this.pageSize,
        limit: this.pageSize,
        search: this.search || undefined,
        sort_by: this.sortKey,
        sort_dir: this.sortDirection,
      })
      .subscribe({
        next: (rows) => {
          this.candidates = rows ?? [];
          if (
            this.selectedViewCandidateId !== null &&
            !this.candidates.some((row) => row.id === this.selectedViewCandidateId)
          ) {
            this.selectedViewCandidateId = null;
          }
          this.hasPrev = this.currentPage > 1;
          this.hasNext = this.candidates.length >= this.pageSize;
          this.loading = false;
          try {
            this.cdr.detectChanges();
          } catch {
            // ignore
          }
        },
        error: () => {
          this.errorMessage = 'candidates.error.load';
          this.candidates = [];
          this.hasPrev = this.currentPage > 1;
          this.hasNext = false;
          this.loading = false;
        },
      });
  }
}
