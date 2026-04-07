import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthApiService } from '../services/auth-api.service';

function safeRedirectTarget(target: string | null): string {
  if (!target) return '';
  if (!target.startsWith('/')) return '';
  if (target.startsWith('//')) return '';
  if (target === '/login') return '';
  return target;
}

export const guestGuard: CanActivateFn = (route) => {
  const auth = inject(AuthApiService);
  const router = inject(Router);

  const requestedRedirect = safeRedirectTarget(route.queryParamMap.get('redirectTo'));

  return auth.resolveCurrentUser().pipe(
    map((user) => {
      if (!user) return true;
      const fallback = user.role === 'admin' ? '/admin/users' : '/dashboard';
      const target = requestedRedirect || fallback;
      return router.parseUrl(target);
    }),
  );
};
