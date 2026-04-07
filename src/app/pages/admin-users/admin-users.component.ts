import { Component, OnInit } from '@angular/core';
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
  loading = true;
  errorKey = '';
  users: CurrentUserResponse[] = [];
  currentUser: CurrentUserResponse | null = null;
  savingUserId: number | null = null;
  readonly roles: UserRole[] = ['admin', 'recruiter', 'user'];

  constructor(
    private readonly auth: AuthApiService,
    private readonly adminUsersApi: AdminUsersApiService,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.errorKey = '';

    this.auth.getMe().subscribe({
      next: (me) => {
        this.currentUser = me;
        this.loadUsers();
      },
      error: () => {
        this.errorKey = 'adminUsers.error.unauthorized';
        this.loading = false;
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
    if (this.currentUser && user.id === this.currentUser.id && targetRole !== 'admin') {
      this.errorKey = 'adminUsers.error.selfDemotion';
      return;
    }

    this.errorKey = '';
    this.savingUserId = user.id;
    this.adminUsersApi
      .updateUserRole(user.id, targetRole)
      .pipe(finalize(() => (this.savingUserId = null)))
      .subscribe({
        next: (updated) => {
          this.users = this.users.map((u) => (u.id === updated.id ? updated : u));
          if (this.currentUser?.id === updated.id) {
            this.currentUser = updated;
            this.auth.loadCurrentUser();
          }
        },
        error: () => {
          this.errorKey = 'adminUsers.error.update';
        },
      });
  }

  isSelf(user: CurrentUserResponse): boolean {
    return this.currentUser?.id === user.id;
  }

  private loadUsers(): void {
    this.adminUsersApi
      .listUsers()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (users) => {
          this.users = users;
        },
        error: () => {
          this.errorKey = 'adminUsers.error.load';
        },
      });
  }
}

