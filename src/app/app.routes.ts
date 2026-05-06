import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { MatchingComponent } from './pages/matching/matching.component';
import { LoginComponent } from './pages/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { AdminUsersComponent } from './pages/admin-users/admin-users.component';
import { UnauthorizedComponent } from './pages/unauthorized/unauthorized.component';
import { CvUploadComponent } from './pages/cv-upload/cv-upload.component';
import { CandidatesComponent } from './pages/candidates/candidates.component';
import { EmployeesComponent } from './pages/employees/employees.component';
import { JobsComponent } from './pages/jobs/jobs.component';
import { SkillsComponent } from './pages/skills/skills.component';
import { LearningQueueComponent } from './pages/learning-queue/learning-queue.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'matching', component: MatchingComponent, canActivate: [authGuard, roleGuard(['admin', 'recruiter'])] },
  { path: 'cv-upload', component: CvUploadComponent, canActivate: [authGuard, roleGuard(['admin', 'recruiter'])] },
  { path: 'candidates', component: CandidatesComponent, canActivate: [authGuard, adminGuard] },
  { path: 'jobs', component: JobsComponent, canActivate: [authGuard, roleGuard(['admin', 'recruiter', 'user'])] },
  { path: 'admin/employees', component: EmployeesComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/jobs', redirectTo: '/jobs', pathMatch: 'full' },
  { path: 'admin/skills', component: SkillsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/learning', component: LearningQueueComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/users', component: AdminUsersComponent, canActivate: [authGuard, adminGuard] },
  { path: 'unauthorized', component: UnauthorizedComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'dashboard' },
];
