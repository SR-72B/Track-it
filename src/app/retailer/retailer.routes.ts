// src/app/retailer/retailer.routes.ts
import { Routes } from '@angular/router';

export const RETAILER_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(c => c.DashboardComponent)
  },
  {
    path: 'orders',
    loadComponent: () => import('./order-list/order-list.component').then(c => c.OrderListComponent)
    // If OrderListComponent is not standalone and OrderListModule provides these routes,
    // you might still use loadChildren to that module's routes if it's a hybrid setup.
    // But the goal here is to move towards standalone components being routed directly.
  },
  {
    path: 'orders/:id',
    loadComponent: () => import('./order-detail/order-detail.component').then(c => c.OrderDetailComponent)
  },
  // ... other retailer routes
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];