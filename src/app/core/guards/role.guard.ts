import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthApiService, UserRole } from '../services/auth-api.service';

export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthApiService);
    const router = inject(Router);

    return auth.resolveCurrentUser().pipe(
      map((user) => {
        if (!user) {
          return router.createUrlTree(['/login'], {
            queryParams: { redirectTo: state.url },
          });
        }

        if (allowedRoles.includes(user.role)) {
          return true;
        }

        return router.createUrlTree(['/unauthorized']);
      }),
    );
  };
}
