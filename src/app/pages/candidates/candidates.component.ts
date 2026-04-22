import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CandidateProfile, CandidatesApiService } from '../../core/services/candidates-api.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { DataTableComponent } from '../../core/components/ui/data-table/data-table.component';
import { ConfirmDialogComponent } from '../../core/components/ui/confirm-dialog/confirm-dialog.component';
import { FormFieldComponent } from '../../core/components/ui/form-field/form-field.component';

type CandidateSortKey = 'id' | 'name' | 'email' | 'title' | 'uploaded_at';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TPipe,
    PageHeaderComponent,
    DataTableComponent,
    ConfirmDialogComponent,
    FormFieldComponent,
  ],
  templateUrl: './candidates.component.html',
})
export class CandidatesComponent implements OnInit {
  loading = true;
  saving = false;
  deletingId: number | null = null;
  savingNameId: number | null = null;

  errorMessage = '';
  actionErrorMessage = '';
  successKey = '';

  candidates: CandidateProfile[] = [];
  selectedViewCandidateId: number | null = null;
  editingCandidateId: number | null = null;
  editingNameCandidateId: number | null = null;
  editingNameDraft = '';
  deleteTarget: CandidateProfile | null = null;

  currentPage = 1;
  pageSize = 20;
  readonly pageSizeOptions = [10, 20, 50];
  hasPrev = false;
  hasNext = false;

  search = '';
  sortKey: CandidateSortKey = 'uploaded_at';
  sortDirection: SortDirection = 'desc';

  readonly form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: CandidatesApiService,
    private readonly apiErrorService: ApiErrorService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.nonNullable.group({
      full_name: ['', [Validators.required]],
      employee_number: ['', [Validators.required]],
      skills_text: [''],
    });
  }

  ngOnInit(): void {
    this.loadCandidates();
  }

  get isEditMode(): boolean {
    return this.editingCandidateId !== null;
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

  startEditCandidate(row: CandidateProfile): void {
    this.cancelEditName();
    this.editingCandidateId = row.id;
    this.successKey = '';
    this.actionErrorMessage = '';
    this.form.patchValue({
      full_name: row.full_name ?? '',
      employee_number: row.employee_number ?? '',
      skills_text: (row.skills ?? []).join(', '),
    });
  }

  selectedEditCandidate(): CandidateProfile | null {
    if (this.editingCandidateId === null) return null;
    return this.candidates.find((row) => row.id === this.editingCandidateId) ?? null;
  }

  cancelEdit(): void {
    this.editingCandidateId = null;
    this.form.reset({
      full_name: '',
      employee_number: '',
      skills_text: '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.actionErrorMessage = '';
  }

  startEditName(row: CandidateProfile): void {
    this.editingNameCandidateId = row.id;
    this.editingNameDraft = row.full_name ?? '';
    this.successKey = '';
    this.actionErrorMessage = '';
  }

  isEditingName(row: CandidateProfile): boolean {
    return this.editingNameCandidateId === row.id;
  }

  cancelEditName(): void {
    if (this.savingNameId !== null) {
      return;
    }
    this.editingNameCandidateId = null;
    this.editingNameDraft = '';
  }

  submitNameEdit(row: CandidateProfile, rawValue: string): void {
    if (this.savingNameId !== null || this.editingNameCandidateId !== row.id) {
      return;
    }
    const fullName = rawValue.trim();
    if (!fullName) {
      this.actionErrorMessage = 'candidates.modify.validation.nameRequired';
      return;
    }
    if (fullName === (row.full_name ?? '').trim()) {
      this.cancelEditName();
      return;
    }

    const previous = { ...row, skills: [...(row.skills ?? [])] };
    this.replaceCandidate({ ...row, full_name: fullName });
    this.savingNameId = row.id;
    this.successKey = '';
    this.actionErrorMessage = '';

    this.api
      .updateCandidate(row.id, { full_name: fullName })
      .pipe(
        finalize(() => {
          this.savingNameId = null;
          this.requestRender();
        }),
      )
      .subscribe({
        next: (updated) => {
          this.replaceCandidate(updated);
          if (this.editingCandidateId === row.id) {
            this.form.patchValue({ full_name: updated.full_name ?? '' });
          }
          this.editingNameCandidateId = null;
          this.editingNameDraft = '';
          this.successKey = 'candidates.editName.success';
          this.requestRender();
        },
        error: (err: unknown) => {
          this.replaceCandidate(previous);
          const normalized = this.apiErrorService.normalize(err);
          this.actionErrorMessage = normalized.i18nKey || normalized.message || 'candidates.editName.error';
          this.requestRender();
        },
      });
  }

  submitEdit(): void {
    if (this.editingCandidateId === null || this.saving) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      full_name: raw.full_name.trim(),
      employee_number: raw.employee_number.trim(),
      skills: this.parseSkillsInput(raw.skills_text),
    };

    this.saving = true;
    this.successKey = '';
    this.actionErrorMessage = '';

    const candidateId = this.editingCandidateId;
    const index = this.candidates.findIndex((row) => row.id === candidateId);
    const previous = index >= 0 ? { ...this.candidates[index], skills: [...(this.candidates[index].skills ?? [])] } : null;

    if (index >= 0) {
      this.candidates = this.candidates.map((candidate, candidateIndex) =>
        candidateIndex !== index
          ? candidate
          : {
              ...candidate,
              full_name: payload.full_name,
              employee_number: payload.employee_number,
              skills: payload.skills,
            },
      );
      this.requestRender();
    }

    this.api
      .updateCandidate(candidateId, payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (updated) => {
          this.replaceCandidate(updated);
          this.cancelEdit();
          this.successKey = 'candidates.modify.success';
          this.requestRender();
        },
        error: (err: unknown) => {
          if (previous) {
            this.replaceCandidate(previous);
          }
          const normalized = this.apiErrorService.normalize(err);
          this.actionErrorMessage = normalized.i18nKey || normalized.message || 'candidates.modify.error';
          this.requestRender();
        },
      });
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
          if (this.editingCandidateId === target.id) {
            this.cancelEdit();
          }
          if (this.editingNameCandidateId === target.id) {
            this.editingNameCandidateId = null;
            this.editingNameDraft = '';
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

  controlInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorKey(controlName: keyof typeof this.form.controls): string {
    if (!this.controlInvalid(controlName)) return '';
    if (controlName === 'full_name') return 'candidates.modify.validation.nameRequired';
    if (controlName === 'employee_number') return 'candidates.modify.validation.idRequired';
    return 'errors.validation';
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
          if (
            this.editingCandidateId !== null &&
            !this.candidates.some((row) => row.id === this.editingCandidateId)
          ) {
            this.cancelEdit();
          }
          if (
            this.editingNameCandidateId !== null &&
            !this.candidates.some((row) => row.id === this.editingNameCandidateId)
          ) {
            this.editingNameCandidateId = null;
            this.editingNameDraft = '';
          }
          this.hasPrev = this.currentPage > 1;
          this.hasNext = this.candidates.length >= this.pageSize;
          this.loading = false;
          this.requestRender();
        },
        error: () => {
          this.errorMessage = 'candidates.error.load';
          this.candidates = [];
          this.hasPrev = this.currentPage > 1;
          this.hasNext = false;
          this.loading = false;
          this.requestRender();
        },
      });
  }

  private parseSkillsInput(value: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of value.split(',')) {
      const skill = raw.trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(skill);
    }
    return out;
  }

  private replaceCandidate(updated: CandidateProfile): void {
    this.candidates = this.candidates.map((candidate) => (candidate.id === updated.id ? updated : candidate));
  }

  private requestRender(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // ignore
    }
  }
}
