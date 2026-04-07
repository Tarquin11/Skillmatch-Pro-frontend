import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Skill, SkillCreatePayload, SkillsApiService, SkillUpdatePayload } from '../../core/services/skills-api.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { DataTableComponent } from '../../core/components/ui/data-table/data-table.component';
import { FormFieldComponent } from '../../core/components/ui/form-field/form-field.component';
import { ConfirmDialogComponent } from '../../core/components/ui/confirm-dialog/confirm-dialog.component';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { UxTelemetryService } from '../../core/services/ux-telemetry.service';

type SkillSortKey = 'id' | 'name';
type SortDirection = 'asc' | 'desc';
const SKILLS_PREF_KEY = 'skills_table';

@Component({
  selector: 'app-skills',
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
  templateUrl: './skills.component.html',
})
export class SkillsComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  deletingId: number | null = null;
  errorMessage = '';
  skills: Skill[] = [];

  currentPage = 1;
  pageSize = 20;
  readonly pageSizeOptions = [10, 20, 50];
  hasPrev = false;
  hasNext = false;
  search = '';
  sortKey: SkillSortKey = 'name';
  sortDirection: SortDirection = 'asc';

  editingId: number | null = null;
  successKey = '';
  deleteTarget: Skill | null = null;

  form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: SkillsApiService,
    private readonly preferences: UserPreferencesService,
    private readonly telemetry: UxTelemetryService,
  ) {
    this.form = this.fb.nonNullable.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
    });
  }

  ngOnInit(): void {
    this.restorePreferences();
    this.loadSkills();
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

    const name = this.form.getRawValue().name.trim();

    if (this.editingId === null) {
      const payload: SkillCreatePayload = { name };
      this.api
        .create(payload)
        .pipe(finalize(() => (this.saving = false)))
        .subscribe({
          next: () => {
            this.resetForm();
            this.currentPage = 1;
            this.successKey = 'skills.success.created';
            this.loadSkills();
          },
          error: (err) => {
            this.errorMessage = this.extractErrorMessage(err);
          },
        });
      return;
    }

    const payload: SkillUpdatePayload = { name };
    const editingId = this.editingId;
    const localIndex = this.skills.findIndex((s) => s.id === editingId);
    const previous = localIndex >= 0 ? { ...this.skills[localIndex] } : null;
    if (localIndex >= 0) {
      this.skills[localIndex] = {
        ...this.skills[localIndex],
        name,
      };
    }
    this.api
      .update(editingId, payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (updated) => {
          if (localIndex >= 0) {
            this.skills[localIndex] = {
              ...this.skills[localIndex],
              ...updated,
            };
          }
          this.resetForm();
          this.successKey = 'skills.success.updated';
        },
        error: (err) => {
          if (localIndex >= 0 && previous) {
            this.skills[localIndex] = previous;
          }
          this.errorMessage = this.extractErrorMessage(err);
        },
      });
  }

  startEdit(skill: Skill): void {
    this.editingId = skill.id;
    this.errorMessage = '';
    this.successKey = '';
    this.form.patchValue({
      name: skill.name ?? '',
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  requestDeleteSkill(skill: Skill): void {
    if (!skill.id || this.deletingId !== null) return;
    this.deleteTarget = skill;
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  confirmDeleteSkill(): void {
    const skill = this.deleteTarget;
    if (!skill?.id || this.deletingId !== null) return;

    const previousRows = [...this.skills];
    this.skills = this.skills.filter((row) => row.id !== skill.id);

    this.deletingId = skill.id;
    this.errorMessage = '';
    this.successKey = '';
    this.deleteTarget = null;
    this.api
      .delete(skill.id)
      .pipe(finalize(() => (this.deletingId = null)))
      .subscribe({
        next: () => {
          if (this.skills.length === 0 && this.currentPage > 1) {
            this.currentPage -= 1;
            this.loadSkills();
            return;
          }
          if (this.hasNext) {
            this.loadSkills();
            return;
          }
          this.successKey = 'skills.success.deleted';
          this.hasPrev = this.currentPage > 1;
        },
        error: (err) => {
          this.skills = previousRows;
          this.errorMessage = this.extractErrorMessage(err);
        },
      });
  }

  applySearch(value: string): void {
    this.search = value.trim();
    this.telemetry.track('skills_search_used', {
      query_length: this.search.length,
    });
    this.currentPage = 1;
    this.successKey = '';
    this.loadSkills();
  }

  ngOnDestroy(): void {
    if (this.form.dirty) {
      this.telemetry.track('skills_form_abandoned', {
        is_edit_mode: this.isEditMode,
        touched_fields: Object.entries(this.form.controls)
          .filter(([, control]) => control.dirty)
          .map(([name]) => name),
      });
    }
  }

  onSort(key: SkillSortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = key === 'id' ? 'desc' : 'asc';
    }
    this.persistSortPreference();
    this.currentPage = 1;
    this.loadSkills();
  }

  sortIndicator(key: SkillSortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDirection === 'asc' ? '^' : 'v';
  }

  ariaSort(key: SkillSortKey): 'none' | 'ascending' | 'descending' {
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

    if (c.hasError('required')) return `skills.validation.${String(controlName)}.required`;
    if (c.hasError('minlength')) return `skills.validation.${String(controlName)}.minlength`;
    return 'errors.validation';
  }

  prevPage(): void {
    if (!this.hasPrev || this.loading) return;
    this.currentPage -= 1;
    this.loadSkills();
  }

  nextPage(): void {
    if (!this.hasNext || this.loading) return;
    this.currentPage += 1;
    this.loadSkills();
  }

  onPageSizeChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    this.pageSize = parsed;
    this.persistPageSizePreference();
    this.currentPage = 1;
    this.loadSkills();
  }

  private restorePreferences(): void {
    const pref = this.preferences.getTablePreference<SkillSortKey>(SKILLS_PREF_KEY);
    if (this.isPageSizeOption(pref.pageSize)) {
      this.pageSize = pref.pageSize;
    }
    if (pref.sort && this.isSortKey(pref.sort.key)) {
      this.sortKey = pref.sort.key;
      this.sortDirection = pref.sort.direction === 'asc' ? 'asc' : 'desc';
    }
  }

  private persistPageSizePreference(): void {
    this.preferences.setTablePageSize(SKILLS_PREF_KEY, this.pageSize);
  }

  private persistSortPreference(): void {
    this.preferences.setTableSort(SKILLS_PREF_KEY, {
      key: this.sortKey,
      direction: this.sortDirection,
    });
  }

  private isPageSizeOption(value: number | undefined): value is number {
    return typeof value === 'number' && this.pageSizeOptions.includes(value);
  }

  private isSortKey(value: string): value is SkillSortKey {
    return value === 'id' || value === 'name';
  }

  private loadSkills(): void {
    this.loading = true;
    this.errorMessage = '';
    this.api
      .list({
        skip: (this.currentPage - 1) * this.pageSize,
        limit: this.pageSize,
        search: this.search || undefined,
        sort_by: this.sortKey,
        sort_dir: this.sortDirection,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (rows) => {
          this.skills = rows;
          this.hasPrev = this.currentPage > 1;
          this.hasNext = rows.length === this.pageSize;
        },
        error: (err) => {
          this.errorMessage = this.extractErrorMessage(err);
          this.skills = [];
          this.hasPrev = false;
          this.hasNext = false;
        },
      });
  }

  private resetForm(): void {
    this.editingId = null;
    this.form.reset({
      name: '',
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
