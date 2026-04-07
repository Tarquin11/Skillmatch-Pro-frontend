import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthApiService } from '../services/auth-api.service';

export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthApiService);
  const router = inject(Router);

  return auth.resolveCurrentUser().pipe(
    map((user) => {
      if (!user) {
        return router.createUrlTree(['/login'], {
          queryParams: { redirectTo: state.url },
        });
      }
      if (user.role === 'admin') {
        return true;
      }
      return router.createUrlTree(['/unauthorized']);
    }),
  );
};
