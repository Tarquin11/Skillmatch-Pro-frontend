import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Job, JobCreatePayload, JobsApiService, JobUpdatePayload } from '../../core/services/jobs-api.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { DataTableComponent } from '../../core/components/ui/data-table/data-table.component';
import { FormFieldComponent } from '../../core/components/ui/form-field/form-field.component';
import { ConfirmDialogComponent } from '../../core/components/ui/confirm-dialog/confirm-dialog.component';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { UxTelemetryService } from '../../core/services/ux-telemetry.service';

type JobSortKey = 'id' | 'title' | 'department';
type SortDirection = 'asc' | 'desc';
const JOBS_PREF_KEY = 'jobs_table';

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TPipe,
    PageHeaderComponent,
    DataTableComponent,
    FormFieldComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './jobs.component.html',
})
export class JobsComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  deletingId: number | null = null;
  errorMessage = '';
  jobs: Job[] = [];

  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = [10, 20, 50];
  hasPrev = false;
  hasNext = false;
  search = '';
  departmentFilter = '';
  sortKey: JobSortKey = 'id';
  sortDirection: SortDirection = 'desc';

  editingId: number | null = null;
  successKey = '';
  deleteTarget: Job | null = null;

  form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: JobsApiService,
    private readonly preferences: UserPreferencesService,
    private readonly telemetry: UxTelemetryService,
  ) {
    this.form = this.fb.nonNullable.group({
      title: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      department: [''],
    });
  }

  ngOnInit(): void {
    this.restorePreferences();
    this.loadJobs();
  }

  get isEditMode(): boolean {
    return this.editingId !== null;
  }

  submit(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.errorMessage = '';

    const raw = this.form.getRawValue();
    const basePayload = {
      title: raw.title.trim(),
      description: raw.description.trim() || null,
      departement: raw.department.trim() || null,
    };

    if (this.editingId === null) {
      const payload: JobCreatePayload = basePayload;
      this.api
        .create(payload)
        .pipe(finalize(() => (this.saving = false)))
        .subscribe({
          next: () => {
            this.resetForm();
            this.currentPage = 1;
            this.successKey = 'jobs.success.created';
            this.loadJobs();
          },
          error: (err) => {
            this.errorMessage = this.extractErrorMessage(err);
          },
        });
      return;
    }

    const payload: JobUpdatePayload = basePayload;
    const editingId = this.editingId;
    const localIndex = this.jobs.findIndex((j) => j.id === editingId);
    const previous = localIndex >= 0 ? { ...this.jobs[localIndex] } : null;
    if (localIndex >= 0) {
      this.jobs[localIndex] = {
        ...this.jobs[localIndex],
        title: payload.title ?? this.jobs[localIndex].title,
        description: payload.description ?? this.jobs[localIndex].description,
        department: payload.departement ?? this.jobs[localIndex].department,
      };
    }
    this.api
      .update(editingId, payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (updated) => {
          if (localIndex >= 0) {
            this.jobs[localIndex] = {
              ...this.jobs[localIndex],
              ...updated,
            };
          }
          this.resetForm();
          this.successKey = 'jobs.success.updated';
        },
        error: (err) => {
          if (localIndex >= 0 && previous) {
            this.jobs[localIndex] = previous;
          }
          this.errorMessage = this.extractErrorMessage(err);
        },
      });
  }

  startEdit(job: Job): void {
    this.editingId = job.id;
    this.errorMessage = '';
    this.successKey = '';
    this.form.patchValue({
      title: job.title ?? '',
      description: job.description ?? '',
      department: job.department ?? '',
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  requestDeleteJob(job: Job): void {
    if (!job.id || this.deletingId !== null) return;
    this.deleteTarget = job;
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  confirmDeleteJob(): void {
    const job = this.deleteTarget;
    if (!job?.id || this.deletingId !== null) return;

    const previousRows = [...this.jobs];
    this.jobs = this.jobs.filter((row) => row.id !== job.id);

    this.deletingId = job.id;
    this.errorMessage = '';
    this.successKey = '';
    this.deleteTarget = null;
    this.api
      .delete(job.id)
      .pipe(finalize(() => (this.deletingId = null)))
      .subscribe({
        next: () => {
          if (this.jobs.length === 0 && this.currentPage > 1) {
            this.currentPage -= 1;
            this.loadJobs();
            return;
          }
          if (this.hasNext) {
            this.loadJobs();
            return;
          }
          this.successKey = 'jobs.success.deleted';
          this.hasPrev = this.currentPage > 1;
        },
        error: (err) => {
          this.jobs = previousRows;
          this.errorMessage = this.extractErrorMessage(err);
        },
      });
  }

  applySearch(value: string): void {
    this.search = value.trim();
    this.telemetry.track('jobs_search_used', {
      query_length: this.search.length,
      has_department_filter: Boolean(this.departmentFilter),
    });
    this.currentPage = 1;
    this.successKey = '';
    this.loadJobs();
  }

  setDepartmentFilter(value: string): void {
    this.departmentFilter = value;
    this.telemetry.track('jobs_filter_changed', {
      department: this.departmentFilter,
      has_search: Boolean(this.search),
    });
    this.currentPage = 1;
    this.loadJobs();
  }

  ngOnDestroy(): void {
    if (this.form.dirty) {
      this.telemetry.track('jobs_form_abandoned', {
        is_edit_mode: this.isEditMode,
        touched_fields: Object.entries(this.form.controls)
          .filter(([, control]) => control.dirty)
          .map(([name]) => name),
      });
    }
  }

  departmentChips(): string[] {
    const unique = new Set<string>();
    for (const row of this.jobs) {
      const dep = (row.department ?? '').trim();
      if (dep) unique.add(dep);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b)).slice(0, 6);
  }

  onSort(key: JobSortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = key === 'id' ? 'desc' : 'asc';
    }
    this.persistSortPreference();
    this.currentPage = 1;
    this.loadJobs();
  }

  sortIndicator(key: JobSortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDirection === 'asc' ? '^' : 'v';
  }

  ariaSort(key: JobSortKey): 'none' | 'ascending' | 'descending' {
    if (this.sortKey !== key) return 'none';
    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  controlInvalid(controlName: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[controlName];
    return c.invalid && (c.dirty || c.touched);
  }

  controlErrorKey(controlName: keyof typeof this.form.controls): string {
    const c = this.form.controls[controlName];
    if (!this.controlInvalid(controlName)) return '';

    if (c.hasError('required')) return `jobs.validation.${String(controlName)}.required`;
    if (c.hasError('minlength')) return `jobs.validation.${String(controlName)}.minlength`;
    return 'errors.validation';
  }

  prevPage(): void {
    if (!this.hasPrev || this.loading) return;
    this.currentPage -= 1;
    this.loadJobs();
  }

  nextPage(): void {
    if (!this.hasNext || this.loading) return;
    this.currentPage += 1;
    this.loadJobs();
  }

  onPageSizeChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    this.pageSize = parsed;
    this.persistPageSizePreference();
    this.currentPage = 1;
    this.loadJobs();
  }

  private restorePreferences(): void {
    const pref = this.preferences.getTablePreference<JobSortKey>(JOBS_PREF_KEY);
    if (this.isPageSizeOption(pref.pageSize)) {
      this.pageSize = pref.pageSize;
    }
    if (pref.sort && this.isSortKey(pref.sort.key)) {
      this.sortKey = pref.sort.key;
      this.sortDirection = pref.sort.direction === 'asc' ? 'asc' : 'desc';
    }
  }

  private persistPageSizePreference(): void {
    this.preferences.setTablePageSize(JOBS_PREF_KEY, this.pageSize);
  }

  private persistSortPreference(): void {
    this.preferences.setTableSort(JOBS_PREF_KEY, {
      key: this.sortKey,
      direction: this.sortDirection,
    });
  }

  private isPageSizeOption(value: number | undefined): value is number {
    return typeof value === 'number' && this.pageSizeOptions.includes(value);
  }

  private isSortKey(value: string): value is JobSortKey {
    return value === 'id' || value === 'title' || value === 'department';
  }

  private loadJobs(): void {
    this.loading = true;
    this.errorMessage = '';
    this.api
      .list({
        skip: (this.currentPage - 1) * this.pageSize,
        limit: this.pageSize,
        search: this.search || undefined,
        department: this.departmentFilter || undefined,
        sort_by: this.sortKey,
        sort_dir: this.sortDirection,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (rows) => {
          this.jobs = rows;
          this.hasPrev = this.currentPage > 1;
          this.hasNext = rows.length === this.pageSize;
        },
        error: (err) => {
          this.errorMessage = this.extractErrorMessage(err);
          this.jobs = [];
          this.hasPrev = false;
          this.hasNext = false;
        },
      });
  }

  private resetForm(): void {
    this.editingId = null;
    this.form.reset({
      title: '',
      description: '',
      department: '',
    });
  }

  private extractErrorMessage(err: unknown): string {
    const detail = (err as { error?: { detail?: { message?: string } } })?.error?.detail?.message;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    return 'Request failed.';
  }
}
