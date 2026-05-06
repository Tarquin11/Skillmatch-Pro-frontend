import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export interface NormalizedApiError {
  status: number;
  code: string;
  message: string;
  i18nKey: string;
}

const CODE_TO_I18N_KEY: Record<string, string> = {
  invalid_credentials: 'errors.invalidCredentials',
  insufficient_permissions: 'errors.forbidden',
  admin_signup_forbidden: 'errors.forbidden',
  email_already_registered: 'errors.emailAlreadyRegistered',
  self_user_delete_forbidden: 'errors.forbidden',
  last_admin_delete_forbidden: 'errors.validation',
  self_admin_demotion_forbidden: 'errors.forbidden',
  last_admin_demotion_forbidden: 'errors.validation',
  user_not_found: 'errors.notFound',
  employee_number_already_exists: 'errors.employeeNumberExists',
  skill_already_exists: 'errors.skillExists',
  invalid_file_type: 'errors.invalidFileType',
  cv_processing_failed: 'errors.cvProcessingFailed',
  candidate_not_found: 'errors.notFound',
  invalid_candidate_name: 'errors.validation',
  invalid_candidate_id: 'errors.validation',
  validation_error: 'errors.validation',
  internal_error: 'errors.server',
};

@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  normalize(error: unknown): NormalizedApiError {
    const httpErr = error as HttpErrorResponse;
    if (!httpErr || typeof httpErr.status !== 'number') {
      return {
        status: 0,
        code: 'unknown_error',
        message: 'Unknown error',
        i18nKey: 'errors.generic',
      };
    }

    const detailCode = this.readDetailCode(httpErr);
    const detailMessage = this.readDetailMessage(httpErr);
    const status = httpErr.status ?? 0;
    const code = detailCode || `http_${status || 0}`;

    return {
      status,
      code,
      message: detailMessage || httpErr.message || 'Request failed',
      i18nKey: this.resolveI18nKey(status, code),
    };
  }

  private resolveI18nKey(status: number, code: string): string {
    const byCode = CODE_TO_I18N_KEY[code];
    if (byCode) return byCode;

    if (status === 0) return 'errors.network';
    if (status === 401) return 'errors.unauthorized';
    if (status === 403) return 'errors.forbidden';
    if (status === 404) return 'errors.notFound';
    if (status === 409) return 'errors.conflict';
    if (status === 422) return 'errors.validation';
    if (status >= 500) return 'errors.server';
    return 'errors.generic';
  }

  private readDetailCode(httpErr: HttpErrorResponse): string {
    const raw = (httpErr.error as { detail?: { code?: unknown } } | null)?.detail?.code;
    return typeof raw === 'string' ? raw : '';
  }

  private readDetailMessage(httpErr: HttpErrorResponse): string {
    const raw = (httpErr.error as { detail?: { message?: unknown } } | null)?.detail?.message;
    return typeof raw === 'string' ? raw : '';
  }
}
