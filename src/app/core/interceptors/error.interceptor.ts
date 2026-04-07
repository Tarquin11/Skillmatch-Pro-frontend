import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiErrorService } from '../services/api-error.service';
import { ToastService } from '../services/toast.service';

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/signup') || url.includes('/auth/refresh');
}

function shouldSkipToast(reqUrl: string, status: number): boolean {
  return status === 401 && isAuthEndpoint(reqUrl);
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const apiError = inject(ApiErrorService);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (req.headers.has('x-skip-global-error')) {
        return throwError(() => err);
      }

      const normalized = apiError.normalize(err);
      const status = (err as HttpErrorResponse)?.status ?? normalized.status;

      if (!shouldSkipToast(req.url, status)) {
        toast.showError(normalized.i18nKey, normalized.message);
      }

      return throwError(() => err);
    }),
  );
};
