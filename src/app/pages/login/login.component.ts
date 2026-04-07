import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthApiService, CurrentUserResponse } from '../../core/services/auth-api.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { UxTelemetryService } from '../../core/services/ux-telemetry.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TPipe],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnDestroy {
  loading = false;
  errorKey = '';

  form;
  private loginSucceeded = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly telemetry: UxTelemetryService,
  ) {
    this.form = this.fb.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      remember_me: [false],
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.telemetry.track('auth_login_invalid_form', {
        email_invalid: this.form.controls.email.invalid,
        password_invalid: this.form.controls.password.invalid,
      });
      return;
    }

    this.loading = true;
    this.errorKey = '';

    const { email, password, remember_me } = this.form.getRawValue();

    this.auth
      .login(email, password, remember_me)
      .pipe(switchMap(() => this.auth.resolveCurrentUser()))
      .subscribe({
        next: (user) => {
          this.loginSucceeded = true;
          this.telemetry.track('auth_login_succeeded', {
            role: user?.role ?? 'unknown',
            remember_me,
          });
          const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
          const target = this.resolvePostLoginTarget(user, redirectTo);
          void this.router.navigateByUrl(target);
          this.loading = false;
        },
        error: () => {
          this.telemetry.track('auth_login_failed', {
            reason: 'invalid_credentials',
            email_domain: this.emailDomain(email),
            remember_me,
          });
          this.errorKey = 'login.error.invalid_credentials';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    if (this.form.dirty && !this.loginSucceeded) {
      this.telemetry.track('login_form_abandoned', {
        email_touched: this.form.controls.email.dirty,
        password_touched: this.form.controls.password.dirty,
      });
    }
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

  private emailDomain(email: string): string {
    const at = email.lastIndexOf('@');
    if (at <= 0 || at === email.length - 1) return '';
    return email.slice(at + 1).toLowerCase();
  }
}
