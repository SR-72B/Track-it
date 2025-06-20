// src/app/retailer/retailer.routes.ts
import { Routes } from '@angular/router';

export const RETAILER_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(c => c.DashboardComponent)
  },
  {
    path: 'orders',
    loadComponent: () => import('./order-management/order-management.component').then(c => c.OrderManagementComponent)
  },
  {
    path: 'orders/:id',
    loadComponent: () => import('./order-detail/order-detail.component').then(c => c.OrderDetailComponent)
  },
  {
    path: 'forms',
    loadComponent: () => import('./form-list/form-list.component').then(c => c.FormListComponent)
  },
  {
    path: 'forms/create',
    loadComponent: () => import('./form-builder/form-builder.component').then(c => c.FormBuilderComponent)
  },
  {
    path: 'forms/edit/:id',
    loadComponent: () => import('./form-builder/form-builder.component').then(c => c.FormBuilderComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/retailer-profile.component').then(c => c.RetailerProfileComponent)
  },
  {
    path: 'analytics',
    loadComponent: () => import('./analytics/analytics.component').then(c => c.AnalyticsComponent)
  }
];
