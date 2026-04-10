import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandidateProfile, CandidatesApiService } from '../../core/services/candidates-api.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { DataTableComponent } from '../../core/components/ui/data-table/data-table.component';

type CandidateSortKey = 'id' | 'name' | 'email' | 'title' | 'uploaded_at';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, TPipe, PageHeaderComponent, DataTableComponent],
  templateUrl: './candidates.component.html',
})
export class CandidatesComponent implements OnInit {
  loading = true;
  errorMessage = '';
  candidates: CandidateProfile[] = [];

  currentPage = 1;
  pageSize = 20;
  readonly pageSizeOptions = [10, 20, 50];
  hasPrev = false;
  hasNext = false;

  search = '';
  sortKey: CandidateSortKey = 'uploaded_at';
  sortDirection: SortDirection = 'desc';

  constructor(private readonly api: CandidatesApiService) {}

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

  skillsLabel(row: CandidateProfile): string {
    if (!row.skills?.length) return 'N/A';
    return row.skills.join(', ');
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
          this.hasPrev = this.currentPage > 1;
          this.hasNext = this.candidates.length >= this.pageSize;
          this.loading = false;
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
