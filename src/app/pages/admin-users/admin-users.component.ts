import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { TPipe } from '../../core/i18n/t.pipe';
import { AdminUsersApiService } from '../../core/services/admin-users-api.service';
import { AuthApiService, CurrentUserResponse, UserRole } from '../../core/services/auth-api.service';
import { PageHeaderComponent } from '../../core/components/ui/page-header/page-header.component';
import { DataTableComponent } from '../../core/components/ui/data-table/data-table.component';
import { FormFieldComponent } from '../../core/components/ui/form-field/form-field.component';
import { ConfirmDialogComponent } from '../../core/components/ui/confirm-dialog/confirm-dialog.component';

type UserFormControlName = 'email' | 'password' | 'role';
type AdminUserForm = FormGroup<{
  email: FormControl<string>;
  password: FormControl<string>;
  role: FormControl<UserRole>;
}>;

@Component({
  selector: 'app-admin-users',
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
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent implements OnInit {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorKey = signal('');
  readonly errorMessage = signal('');
  readonly successKey = signal('');
  readonly users = signal<CurrentUserResponse[]>([]);
  readonly currentUser = signal<CurrentUserResponse | null>(null);
  readonly savingUserId = signal<number | null>(null);
  readonly deletingUserId = signal<number | null>(null);
  readonly deleteTarget = signal<CurrentUserResponse | null>(null);
  readonly roles: UserRole[] = ['user', 'recruiter', 'admin'];

  form: AdminUserForm;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthApiService,
    private readonly adminUsersApi: AdminUsersApiService,
  ) {
    this.form = this.fb.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: this.fb.nonNullable.control<UserRole>('user', [Validators.required]),
    });
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.clearMessages();

    this.auth.getMe().subscribe({
      next: (me) => {
        this.currentUser.set(me);
        this.loadUsers();
      },
      error: () => {
        this.errorKey.set('adminUsers.error.unauthorized');
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const role = this.toUserRole(raw.role);
    if (!role) {
      this.setTranslatedError('adminUsers.error.invalidRole');
      return;
    }

    this.saving.set(true);
    this.clearMessages();

    this.adminUsersApi
      .createUser({
        email: raw.email.trim(),
        password: raw.password,
        role,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (created) => {
          this.users.update((rows) => this.sortUsers([...rows, created]));
          this.form.reset({
            email: '',
            password: '',
            role: 'user',
          });
          this.successKey.set('adminUsers.success.created');
        },
        error: (err) => {
          this.setRequestError(err, 'adminUsers.error.create');
        },
      });
  }

  resetForm(): void {
    this.form.reset({
      email: '',
      password: '',
      role: 'user',
    });
    this.clearMessages();
  }

  updateRole(user: CurrentUserResponse, roleValue: string, select?: HTMLSelectElement): void {
    const targetRole = this.toUserRole(roleValue);
    if (!targetRole) {
      this.resetRoleSelect(select, user);
      this.setTranslatedError('adminUsers.error.invalidRole');
      return;
    }
    if (user.role === targetRole) {
      return;
    }
    const me = this.currentUser();
    if (me && user.id === me.id && targetRole !== 'admin') {
      this.resetRoleSelect(select, user);
      this.setTranslatedError('adminUsers.error.selfDemotion');
      return;
    }

    this.clearMessages();
    this.savingUserId.set(user.id);
    this.adminUsersApi
      .updateUserRole(user.id, targetRole)
      .pipe(finalize(() => this.savingUserId.set(null)))
      .subscribe({
        next: (updated) => {
          this.users.update((rows) => rows.map((u) => (u.id === updated.id ? updated : u)));
          this.successKey.set('adminUsers.success.updated');
          if (this.currentUser()?.id === updated.id) {
            this.currentUser.set(updated);
            this.auth.loadCurrentUser();
          }
        },
        error: (err) => {
          this.resetRoleSelect(select, user);
          this.setRequestError(err, 'adminUsers.error.update');
        },
      });
  }

  requestDeleteUser(user: CurrentUserResponse): void {
    if (this.deletingUserId() !== null) return;
    if (this.isSelf(user)) {
      this.setTranslatedError('adminUsers.error.selfDelete');
      return;
    }
    if (this.isLastAdmin(user)) {
      this.setTranslatedError('adminUsers.error.lastAdminDelete');
      return;
    }
    this.clearMessages();
    this.deleteTarget.set(user);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  confirmDeleteUser(): void {
    const user = this.deleteTarget();
    if (!user || this.deletingUserId() !== null) return;

    const previousRows = this.users();
    this.users.set(previousRows.filter((row) => row.id !== user.id));
    this.deleteTarget.set(null);
    this.deletingUserId.set(user.id);
    this.clearMessages();

    this.adminUsersApi
      .deleteUser(user.id)
      .pipe(finalize(() => this.deletingUserId.set(null)))
      .subscribe({
        next: () => {
          this.successKey.set('adminUsers.success.deleted');
        },
        error: (err) => {
          this.users.set(previousRows);
          this.setRequestError(err, 'adminUsers.error.delete');
        },
      });
  }

  isSelf(user: CurrentUserResponse): boolean {
    return this.currentUser()?.id === user.id;
  }

  isLastAdmin(user: CurrentUserResponse): boolean {
    return user.role === 'admin' && this.users().filter((row) => row.role === 'admin').length <= 1;
  }

  canDelete(user: CurrentUserResponse): boolean {
    return !this.isSelf(user) && !this.isLastAdmin(user);
  }

  controlInvalid(controlName: UserFormControlName): boolean {
    const c = this.form.controls[controlName];
    return c.invalid && (c.dirty || c.touched);
  }

  controlErrorKey(controlName: UserFormControlName): string {
    const c = this.form.controls[controlName];
    if (!this.controlInvalid(controlName)) return '';

    if (c.hasError('required')) return `adminUsers.validation.${controlName}.required`;
    if (c.hasError('email')) return `adminUsers.validation.${controlName}.email`;
    if (c.hasError('minlength')) return `adminUsers.validation.${controlName}.minlength`;
    return 'errors.validation';
  }

  private loadUsers(): void {
    this.loading.set(true);
    this.adminUsersApi
      .listUsers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => {
          this.users.set(this.sortUsers(users));
        },
        error: (err) => {
          this.setRequestError(err, 'adminUsers.error.load');
        },
      });
  }

  private clearMessages(): void {
    this.errorKey.set('');
    this.errorMessage.set('');
    this.successKey.set('');
  }

  private setTranslatedError(key: string): void {
    this.successKey.set('');
    this.errorMessage.set('');
    this.errorKey.set(key);
  }

  private setRequestError(err: unknown, fallbackKey: string): void {
    this.successKey.set('');
    const detail = (err as { error?: { detail?: { message?: string } } })?.error?.detail?.message;
    if (typeof detail === 'string' && detail.trim()) {
      this.errorKey.set('');
      this.errorMessage.set(detail);
      return;
    }
    this.errorMessage.set('');
    this.errorKey.set(fallbackKey);
  }

  private toUserRole(value: string): UserRole | null {
    return this.roles.includes(value as UserRole) ? (value as UserRole) : null;
  }

  private resetRoleSelect(select: HTMLSelectElement | undefined, user: CurrentUserResponse): void {
    if (select) {
      select.value = user.role;
    }
  }

  private sortUsers(users: CurrentUserResponse[]): CurrentUserResponse[] {
    return [...users].sort((a, b) => a.id - b.id);
  }
}
