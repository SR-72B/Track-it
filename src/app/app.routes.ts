// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';
import { RetailerGuard } from './auth/retailer.guard';
import { CustomerGuard } from './auth/customer.guard';

export const routes: Routes = [
  // Default redirect
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },

  // Authentication routes
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then(r => r.AUTH_ROUTES)
  },

  // Retailer specific routes
  {
    path: 'retailer',
    loadChildren: () => import('./retailer/retailer.routes').then(r => r.RETAILER_ROUTES),
    canActivate: [AuthGuard, RetailerGuard]
  },

  // Customer specific routes
  {
    path: 'customer',
    loadChildren: () => import('./customer/customer.routes').then(r => r.CUSTOMER_ROUTES),
    canActivate: [AuthGuard, CustomerGuard]
  },

  // Communication routes
  {
    path: 'communication',
    loadChildren: () => import('./communication/communication.routes').then(r => r.COMMUNICATION_ROUTES),
    canActivate: [AuthGuard]
  },

  // Payment routes
  {
    path: 'payment',
    loadChildren: () => import('./payment/payment.routes').then(r => r.PAYMENT_ROUTES),
    canActivate: [AuthGuard]
  },

  // Wildcard route - must be last
  { path: '**', redirectTo: '/auth/login' }
];
