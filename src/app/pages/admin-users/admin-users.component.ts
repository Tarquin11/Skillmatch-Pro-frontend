import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { TPipe } from '../../core/i18n/t.pipe';
import { AdminUsersApiService } from '../../core/services/admin-users-api.service';
import { AuthApiService, CurrentUserResponse, UserRole } from '../../core/services/auth-api.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent implements OnInit {
  readonly loading = signal(true);
  readonly errorKey = signal('');
  readonly users = signal<CurrentUserResponse[]>([]);
  readonly currentUser = signal<CurrentUserResponse | null>(null);
  readonly savingUserId = signal<number | null>(null);
  readonly roles: UserRole[] = ['admin', 'recruiter', 'user'];

  constructor(
    private readonly auth: AuthApiService,
    private readonly adminUsersApi: AdminUsersApiService,
  ) {}

  ngOnInit(): void {
    this.loading.set(true);
    this.errorKey.set('');

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

  updateRole(user: CurrentUserResponse, roleValue: string): void {
    const targetRole = roleValue as UserRole;
    if (!this.roles.includes(targetRole)) {
      return;
    }
    if (user.role === targetRole) {
      return;
    }
    const me = this.currentUser();
    if (me && user.id === me.id && targetRole !== 'admin') {
      this.errorKey.set('adminUsers.error.selfDemotion');
      return;
    }

    this.errorKey.set('');
    this.savingUserId.set(user.id);
    this.adminUsersApi
      .updateUserRole(user.id, targetRole)
      .pipe(finalize(() => this.savingUserId.set(null)))
      .subscribe({
        next: (updated) => {
          this.users.update((rows) => rows.map((u) => (u.id === updated.id ? updated : u)));
          if (this.currentUser()?.id === updated.id) {
            this.currentUser.set(updated);
            this.auth.loadCurrentUser();
          }
        },
        error: () => {
          this.errorKey.set('adminUsers.error.update');
        },
      });
  }

  isSelf(user: CurrentUserResponse): boolean {
    return this.currentUser()?.id === user.id;
  }

  private loadUsers(): void {
    this.adminUsersApi
      .listUsers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => {
          this.users.set(users);
        },
        error: () => {
          this.errorKey.set('adminUsers.error.load');
        },
      });
  }
}
