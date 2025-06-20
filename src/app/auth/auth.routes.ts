// src/app/auth/auth.routes.ts
import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(c => c.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./signup/signup.component').then(c => c.SignupComponent)
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./email-verification/email-verification.component').then(c => c.EmailVerificationComponent)
  }
];
