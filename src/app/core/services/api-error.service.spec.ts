import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorService } from './api-error.service';

describe('ApiErrorService', () => {
  let service: ApiErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiErrorService],
    });
    service = TestBed.inject(ApiErrorService);
  });

  it('should map backend error code to translated key', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: {
        detail: {
          code: 'email_already_registered',
          message: 'Email already registered',
        },
      },
    });

    const normalized = service.normalize(error);
    expect(normalized.status).toBe(409);
    expect(normalized.code).toBe('email_already_registered');
    expect(normalized.i18nKey).toBe('errors.emailAlreadyRegistered');
  });

  it('should map unauthorized status fallback when code is missing', () => {
    const error = new HttpErrorResponse({
      status: 401,
      error: {
        detail: { message: 'Unauthorized' },
      },
    });

    const normalized = service.normalize(error);
    expect(normalized.code).toBe('http_401');
    expect(normalized.i18nKey).toBe('errors.unauthorized');
  });

  it('should map unknown/non-http errors to generic', () => {
    const normalized = service.normalize(new Error('boom'));
    expect(normalized.i18nKey).toBe('errors.generic');
  });
});
