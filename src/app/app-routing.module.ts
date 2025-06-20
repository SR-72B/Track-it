// src/app/app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes, PreloadAllModules } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';
import { RetailerGuard } from './auth/retailer.guard';
import { CustomerGuard } from './auth/customer.guard';
import { SubscriptionGuard } from './auth/subscription.guard';

const routes: Routes = [
  // Default redirect
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },

  // Authentication routes (no guards needed)
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule)
  },

  // Retailer routes (protected)
  {
    path: 'retailer',
    loadChildren: () => import('./retailer/retailer.module').then(m => m.RetailerModule),
    canActivate: [AuthGuard, RetailerGuard],
    data: { preload: true }
  },

  // Customer routes (protected)
  {
    path: 'customer',
    loadChildren: () => import('./customer/customer.module').then(m => m.CustomerModule),
    canActivate: [AuthGuard, CustomerGuard],
    data: { preload: true }
  },

  // Communication routes (protected)
  {
    path: 'communication',
    loadChildren: () => import('./communication/communication.module').then(m => m.CommunicationModule),
    canActivate: [AuthGuard],
    data: { preload: false }
  },

  // Payment routes (protected)
  {
    path: 'payment',
    loadChildren: () => import('./payment/payment.module').then(m => m.PaymentModule),
    canActivate: [AuthGuard],
    data: { preload: false }
  },

  // Shared routes (if needed)
  {
    path: 'shared',
    loadChildren: () => import('./shared/shared.module').then(m => m.SharedModule),
    canActivate: [AuthGuard],
    data: { preload: false }
  },

  // Wildcard route - must be last
  { path: '**', redirectTo: '/auth/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    enableTracing: false, // Set to true for debugging routing issues
    preloadingStrategy: PreloadAllModules, // Preload all lazy-loaded modules for better performance
    onSameUrlNavigation: 'reload', // Reload component when navigating to same URL
    scrollPositionRestoration: 'top', // Scroll to top on route change
    paramsInheritanceStrategy: 'emptyOnly' // Inherit params only when empty
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
