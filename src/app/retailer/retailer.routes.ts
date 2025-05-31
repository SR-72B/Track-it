// src/app/retailer/retailer.routes.ts
import { Routes } from '@angular/router';

// Assuming these components are or will be standalone.
// Ensure the paths in loadComponent are correct relative to this routes file.
// import { DashboardComponent } from './dashboard/dashboard.component';
// import { OrderListComponent } from './order-list/order-list.component';
// import { OrderDetailComponent } from './order-detail/order-detail.component';
// import { FormListComponent } from './form-list/form-list.component';
// import { FormBuilderComponent } from './form-builder/form-builder.component';
// import { RetailerProfileComponent } from './profile/retailer-profile.component';
// import { AnalyticsComponent } from './analytics/analytics.component'; // Assuming you have an analytics component

export const RETAILER_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(c => c.DashboardComponent)
  },
  {
    path: 'orders',
    loadComponent: () => import('./order-list/order-list.component').then(c => c.OrderListComponent)
  },
  {
    path: 'orders/:id', // For viewing a specific order detail
    loadComponent: () => import('./order-detail/order-detail.component').then(c => c.OrderDetailComponent)
  },
  {
    path: 'forms', // Lists all forms created by the retailer
    loadComponent: () => import('./form-list/form-list.component').then(c => c.FormListComponent)
  },
  {
    path: 'forms/create', // For creating a new form
    loadComponent: () => import('./form-builder/form-builder.component').then(c => c.FormBuilderComponent)
  },
  {
    path: 'forms/edit/:id', // For editing an existing form
    loadComponent: () => import('./form-builder/form-builder.component').then(c => c.FormBuilderComponent)
  },
  {
    path: 'profile', // Retailer's profile page
    loadComponent: () => import('./profile/retailer-profile.component').then(c => c.RetailerProfileComponent)
  },
  {
    path: 'analytics', // For order analytics
    loadComponent: () => import('./analytics/analytics.component').then(c => c.AnalyticsComponent)
    // Ensure you have an AnalyticsComponent created at this path, or adjust as needed.
  },
  // Default route within the 'retailer' section
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
