// src/app/auth/auth.routes.ts
import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(c => c.LoginComponent)
    // If LoginComponent is not standalone but part of an AuthModule that is now only for providing services or very specific non-routed components,
    // this approach might change. But assuming LoginComponent, SignupComponent etc. are becoming standalone.
  },
  {
    path: 'signup',
    loadComponent: () => import('./signup/signup.component').then(c => c.SignupComponent)
  },
  {
    path: 'verify-email', // Route for your standalone EmailVerificationComponent
    loadComponent: () => import('./email-verification/email-verification.component').then(c => c.EmailVerificationComponent)
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' } // Default route within the 'auth' path
];