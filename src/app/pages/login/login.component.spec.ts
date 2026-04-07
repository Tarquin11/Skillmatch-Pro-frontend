import { TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthApiService } from '../../core/services/auth-api.service';

describe('LoginComponent', () => {
  let routeStub: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } };
  let routerStub: { navigateByUrl: ReturnType<typeof vi.fn> };
  let authStub: {
    login: ReturnType<typeof vi.fn>;
    resolveCurrentUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    routeStub = {
      snapshot: {
        queryParamMap: convertToParamMap({}),
      },
    };
    routerStub = {
      navigateByUrl: vi.fn().mockResolvedValue(true),
    };
    authStub = {
      login: vi.fn().mockReturnValue(of({ access_token: 'token' })),
      resolveCurrentUser: vi.fn().mockReturnValue(
        of({
          id: 1,
          email: 'u@example.com',
          is_active: true,
          role: 'user',
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: routerStub },
        { provide: AuthApiService, useValue: authStub as unknown as AuthApiService },
      ],
    }).compileComponents();
  });

  it('should redirect admin to admin users page after login', () => {
    authStub.resolveCurrentUser.mockReturnValue(
      of({
        id: 9,
        email: 'admin@example.com',
        is_active: true,
        role: 'admin',
      }),
    );

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'admin@example.com', password: 'secret123', remember_me: false });

    component.submit();

    expect(authStub.login).toHaveBeenCalledWith('admin@example.com', 'secret123', false);
    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/admin/users');
  });

  it('should use safe redirectTo query parameter when provided', () => {
    routeStub.snapshot.queryParamMap = convertToParamMap({ redirectTo: '/matching' });

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'user@example.com', password: 'secret123', remember_me: true });

    component.submit();

    expect(authStub.login).toHaveBeenCalledWith('user@example.com', 'secret123', true);
    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/matching');
  });

  it('should not submit when form is invalid', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ email: 'bad-email', password: '123', remember_me: false });

    component.submit();

    expect(authStub.login).not.toHaveBeenCalled();
  });
});
