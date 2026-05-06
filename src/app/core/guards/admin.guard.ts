import { CanActivateFn } from '@angular/router';
import { roleGuard } from './role.guard';

export const adminGuard: CanActivateFn = roleGuard(['admin']);
