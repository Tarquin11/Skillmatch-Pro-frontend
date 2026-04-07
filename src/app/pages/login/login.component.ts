import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthApiService, CurrentUserResponse } from '../../core/services/auth-api.service';
import { TPipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TPipe],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  loading = false;
  errorKey = '';

  form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    this.form = this.fb.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    this.loading = true;
    this.errorKey = '';

    const { email, password } = this.form.getRawValue();

    this.auth
      .login(email, password)
      .pipe(switchMap(() => this.auth.resolveCurrentUser()))
      .subscribe({
        next: (user) => {
          const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
          const target = this.resolvePostLoginTarget(user, redirectTo);
          void this.router.navigateByUrl(target);
          this.loading = false;
        },
        error: () => {
          this.errorKey = 'login.error.invalid_credentials';
          this.loading = false;
        },
      });
  }

  private resolvePostLoginTarget(user: CurrentUserResponse | null, redirectTo: string | null): string {
    const safeRedirect = this.safeRedirectTarget(redirectTo);
    if (safeRedirect) return safeRedirect;

    if (user?.role === 'admin') {
      return '/admin/users';
    }
    return '/dashboard';
  }

  private safeRedirectTarget(target: string | null): string | null {
    if (!target) return null;
    if (!target.startsWith('/')) return null;
    if (target.startsWith('//')) return null;
    if (target === '/login') return null;
    return target;
  }
}
