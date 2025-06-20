/// src/app/customer/customer.routes.ts
import { Routes } from '@angular/router';

export const CUSTOMER_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/customer-dashboard.component').then(c => c.CustomerDashboardComponent)
  },
  {
    path: 'orders',
    loadComponent: () => import('./order-list/customer-order-list.component').then(c => c.CustomerOrderListComponent)
  },
  {
    path: 'orders/:id',
    loadComponent: () => import('./order-detail/customer-order-detail.component').then(c => c.CustomerOrderDetailComponent)
  },
  {
    path: 'tracking/:id',
    loadComponent: () => import('./order-tracking/order-tracking.component').then(c => c.OrderTrackingComponent)
  },
  {
    path: 'forms',
    loadComponent: () => import('./available-forms/available-forms.component').then(c => c.AvailableFormsComponent)
  },
  {
    path: 'place-order/:id',
    loadComponent: () => import('./place-order/place-order.component').then(c => c.PlaceOrderComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/customer-profile.component').then(c => c.CustomerProfileComponent)
  }
];
