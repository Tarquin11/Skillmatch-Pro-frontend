import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  Employee,
  EmployeeCreatePayload,
  EmployeesApiService,
  EmployeeUpdatePayload,
} from '../../core/services/employees-api.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { DataTableComponent } from '../../core/components/ui/data-table/data-table.component';
import { FormFieldComponent } from '../../core/components/ui/form-field/form-field.component';
import { ConfirmDialogComponent } from '../../core/components/ui/confirm-dialog/confirm-dialog.component';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { UxTelemetryService } from '../../core/services/ux-telemetry.service';

type EmployeeSortKey = 'id' | 'first_name' | 'last_name' | 'email' | 'department' | 'position';
type SortDirection = 'asc' | 'desc';
const EMPLOYEES_PREF_KEY = 'employees_table';

@Component({
  selector: 'app-employees',
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
  templateUrl: './employees.component.html',
})
export class EmployeesComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  deletingId: number | null = null;
  errorMessage = '';
  employees: Employee[] = [];

  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = [10, 20, 50];
  hasPrev = false;
  hasNext = false;
  search = '';
  departmentFilter = '';
  sortKey: EmployeeSortKey = 'id';
  sortDirection: SortDirection = 'desc';

  editingId: number | null = null;
  successKey = '';
  deleteTarget: Employee | null = null;

  form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: EmployeesApiService,
    private readonly preferences: UserPreferencesService,
    private readonly telemetry: UxTelemetryService,
  ) {
    this.form = this.fb.nonNullable.group({
      employeeNumber: ['', [Validators.required, Validators.minLength(2)]],
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      department: [''],
      position: [''],
    });
  }

  ngOnInit(): void {
    this.restorePreferences();
    this.loadEmployees();
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
    const fullName = `${raw.first_name} ${raw.last_name}`.trim();

    if (this.editingId === null) {
      const payload: EmployeeCreatePayload = {
        employeeNumber: raw.employeeNumber.trim(),
        first_name: raw.first_name.trim(),
        last_name: raw.last_name.trim(),
        email: raw.email.trim(),
        full_name: fullName || null,
        department: raw.department.trim() || null,
        position: raw.position.trim() || null,
      };

      this.api
        .create(payload)
        .pipe(finalize(() => (this.saving = false)))
        .subscribe({
          next: () => {
            this.resetForm();
            this.currentPage = 1;
            this.successKey = 'employees.success.created';
            this.loadEmployees();
          },
          error: (err) => {
            this.errorMessage = this.extractErrorMessage(err);
          },
        });
      return;
    }

    const updatePayload: EmployeeUpdatePayload = {
      employeeNumber: raw.employeeNumber.trim(),
      first_name: raw.first_name.trim(),
      last_name: raw.last_name.trim(),
      email: raw.email.trim(),
      full_name: fullName || null,
      department: raw.department.trim() || null,
      position: raw.position.trim() || null,
    };
    const editingId = this.editingId;
    const localIndex = this.employees.findIndex((e) => e.id === editingId);
    const previous = localIndex >= 0 ? { ...this.employees[localIndex] } : null;
    if (localIndex >= 0) {
      this.employees[localIndex] = {
        ...this.employees[localIndex],
        employee_number: updatePayload.employeeNumber ?? this.employees[localIndex].employee_number,
        first_name: updatePayload.first_name ?? this.employees[localIndex].first_name,
        last_name: updatePayload.last_name ?? this.employees[localIndex].last_name,
        full_name: updatePayload.full_name ?? this.employees[localIndex].full_name,
        email: updatePayload.email ?? this.employees[localIndex].email,
        department: updatePayload.department ?? this.employees[localIndex].department,
        position: updatePayload.position ?? this.employees[localIndex].position,
      };
    }

    this.api
      .update(editingId, updatePayload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (updated) => {
          if (localIndex >= 0) {
            this.employees[localIndex] = {
              ...this.employees[localIndex],
              ...updated,
            };
          }
          this.resetForm();
          this.successKey = 'employees.success.updated';
        },
        error: (err) => {
          if (localIndex >= 0 && previous) {
            this.employees[localIndex] = previous;
          }
          this.errorMessage = this.extractErrorMessage(err);
        },
      });
  }

  startEdit(employee: Employee): void {
    this.editingId = employee.id;
    this.errorMessage = '';
    this.successKey = '';
    this.form.patchValue({
      employeeNumber: employee.employee_number ?? '',
      first_name: employee.first_name ?? '',
      last_name: employee.last_name ?? '',
      email: employee.email ?? '',
      department: employee.department ?? '',
      position: employee.position ?? '',
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  requestDeleteEmployee(employee: Employee): void {
    if (!employee.id || this.deletingId !== null) return;
    this.deleteTarget = employee;
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  confirmDeleteEmployee(): void {
    const employee = this.deleteTarget;
    if (!employee?.id || this.deletingId !== null) return;

    const previousRows = [...this.employees];
    this.employees = this.employees.filter((row) => row.id !== employee.id);

    this.deletingId = employee.id;
    this.errorMessage = '';
    this.successKey = '';
    this.deleteTarget = null;

    this.api
      .delete(employee.id)
      .pipe(finalize(() => (this.deletingId = null)))
      .subscribe({
        next: () => {
          if (this.employees.length === 0 && this.currentPage > 1) {
            this.currentPage -= 1;
            this.loadEmployees();
            return;
          }
          if (this.hasNext) {
            this.loadEmployees();
            return;
          }
          this.successKey = 'employees.success.deleted';
          this.hasPrev = this.currentPage > 1;
        },
        error: (err) => {
          this.employees = previousRows;
          this.errorMessage = this.extractErrorMessage(err);
        },
      });
  }

  applySearch(value: string): void {
    this.search = value.trim();
    this.telemetry.track('employees_search_used', {
      query_length: this.search.length,
      has_department_filter: Boolean(this.departmentFilter),
    });
    this.currentPage = 1;
    this.successKey = '';
    this.loadEmployees();
  }

  setDepartmentFilter(value: string): void {
    this.departmentFilter = value;
    this.telemetry.track('employees_filter_changed', {
      department: this.departmentFilter,
      has_search: Boolean(this.search),
    });
    this.currentPage = 1;
    this.loadEmployees();
  }

  ngOnDestroy(): void {
    if (this.form.dirty) {
      this.telemetry.track('employees_form_abandoned', {
        is_edit_mode: this.isEditMode,
        touched_fields: Object.entries(this.form.controls)
          .filter(([, control]) => control.dirty)
          .map(([name]) => name),
      });
    }
  }

  departmentChips(): string[] {
    const unique = new Set<string>();
    for (const row of this.employees) {
      const dep = (row.department ?? '').trim();
      if (dep) unique.add(dep);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b)).slice(0, 6);
  }

  onSort(key: EmployeeSortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = key === 'id' ? 'desc' : 'asc';
    }
    this.persistSortPreference();
    this.currentPage = 1;
    this.loadEmployees();
  }

  sortIndicator(key: EmployeeSortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDirection === 'asc' ? '^' : 'v';
  }

  ariaSort(key: EmployeeSortKey): 'none' | 'ascending' | 'descending' {
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

    if (c.hasError('required')) return `employees.validation.${String(controlName)}.required`;
    if (c.hasError('email')) return `employees.validation.${String(controlName)}.email`;
    if (c.hasError('minlength')) return `employees.validation.${String(controlName)}.minlength`;
    return 'errors.validation';
  }

  prevPage(): void {
    if (!this.hasPrev || this.loading) return;
    this.currentPage -= 1;
    this.loadEmployees();
  }

  nextPage(): void {
    if (!this.hasNext || this.loading) return;
    this.currentPage += 1;
    this.loadEmployees();
  }

  onPageSizeChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    this.pageSize = parsed;
    this.persistPageSizePreference();
    this.currentPage = 1;
    this.loadEmployees();
  }

  private restorePreferences(): void {
    const pref = this.preferences.getTablePreference<EmployeeSortKey>(EMPLOYEES_PREF_KEY);
    if (this.isPageSizeOption(pref.pageSize)) {
      this.pageSize = pref.pageSize;
    }
    if (pref.sort && this.isSortKey(pref.sort.key)) {
      this.sortKey = pref.sort.key;
      this.sortDirection = pref.sort.direction === 'asc' ? 'asc' : 'desc';
    }
  }

  private persistPageSizePreference(): void {
    this.preferences.setTablePageSize(EMPLOYEES_PREF_KEY, this.pageSize);
  }

  private persistSortPreference(): void {
    this.preferences.setTableSort(EMPLOYEES_PREF_KEY, {
      key: this.sortKey,
      direction: this.sortDirection,
    });
  }

  private isPageSizeOption(value: number | undefined): value is number {
    return typeof value === 'number' && this.pageSizeOptions.includes(value);
  }

  private isSortKey(value: string): value is EmployeeSortKey {
    return (
      value === 'id' ||
      value === 'first_name' ||
      value === 'last_name' ||
      value === 'email' ||
      value === 'department' ||
      value === 'position'
    );
  }

  private loadEmployees(): void {
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
          this.employees = rows;
          this.hasPrev = this.currentPage > 1;
          this.hasNext = rows.length === this.pageSize;
        },
        error: (err) => {
          this.errorMessage = this.extractErrorMessage(err);
          this.employees = [];
          this.hasPrev = false;
          this.hasNext = false;
        },
      });
  }

  private resetForm(): void {
    this.editingId = null;
    this.form.reset({
      employeeNumber: '',
      first_name: '',
      last_name: '',
      email: '',
      department: '',
      position: '',
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
