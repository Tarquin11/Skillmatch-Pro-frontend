import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthApiService } from '../services/auth-api.service';

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/signup') ||
    url.includes('/auth/refresh')
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthApiService);
  const router = inject(Router);

  const token = auth.getAccessToken();
  const authorizedReq =
    token && !isAuthEndpoint(req.url)
      ? req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        })
      : req;

  return next(authorizedReq).pipe(
    catchError((err: unknown) => {
      const httpErr = err as HttpErrorResponse;
      if (
        httpErr?.status !== 401 ||
        isAuthEndpoint(req.url) ||
        req.headers.has('x-refresh-attempt')
      ) {
        return throwError(() => err);
      }

      return auth.refreshToken().pipe(
        switchMap(() => {
          const nextToken = auth.getAccessToken();
          if (!nextToken) {
            auth.logout();
            void router.navigateByUrl('/login');
            return throwError(() => err);
          }

          const retriedReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${nextToken}`,
              'x-refresh-attempt': '1',
            },
          });
          return next(retriedReq);
        }),
        catchError((refreshErr) => {
          auth.logout();
          void router.navigateByUrl('/login');
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};

