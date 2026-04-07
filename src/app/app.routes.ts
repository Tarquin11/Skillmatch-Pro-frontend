import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { MatchingComponent } from './pages/matching/matching.component';
import { LoginComponent } from './pages/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { guestGuard } from './core/guards/guest.guard';
import { AdminUsersComponent } from './pages/admin-users/admin-users.component';
import { UnauthorizedComponent } from './pages/unauthorized/unauthorized.component';
import { CvUploadComponent } from './pages/cv-upload/cv-upload.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'matching', component: MatchingComponent, canActivate: [authGuard] },
  { path: 'cv-upload', component: CvUploadComponent, canActivate: [authGuard] },
  { path: 'admin/users', component: AdminUsersComponent, canActivate: [authGuard, adminGuard] },
  { path: 'unauthorized', component: UnauthorizedComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'dashboard' },
];
