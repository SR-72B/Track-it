// src/app/customer/customer.routes.ts
import { Routes } from '@angular/router';

// Assuming these components are or will be standalone.
// Ensure the paths in loadComponent are correct relative to this routes file.
// import { CustomerDashboardComponent } from './dashboard/customer-dashboard.component';
// import { CustomerOrderListComponent } from './order-list/customer-order-list.component';
// import { CustomerOrderDetailComponent } from './order-detail/customer-order-detail.component';
// import { AvailableFormsComponent } from './available-forms/available-forms.component';
// import { CustomerOrderFormComponent } from './order-form/customer-order-form.component'; // Or PlaceOrderComponent if filename differs
// import { OrderTrackingComponent } from './order-tracking/order-tracking.component';

export const CUSTOMER_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/customer-dashboard.component').then(c => c.CustomerDashboardComponent)
  },
  {
    path: 'orders',
    loadComponent: () => import('./order-list/customer-order-list.component').then(c => c.CustomerOrderListComponent)
  },
  {
    path: 'orders/:id', // Route to view order details
    loadComponent: () => import('./order-detail/customer-order-detail.component').then(c => c.CustomerOrderDetailComponent)
  },
  {
    path: 'tracking/:orderId', // Route for order tracking
    loadComponent: () => import('./order-tracking/order-tracking.component').then(c => c.OrderTrackingComponent)
  },
  {
    path: 'forms', // Lists available forms for the customer to place an order
    loadComponent: () => import('./available-forms/available-forms.component').then(c => c.AvailableFormsComponent)
  },
  {
    path: 'forms/:formId', // Route to fill out a specific order form (using CustomerOrderFormComponent)
    loadComponent: () => import('./order-form/customer-order-form.component').then(c => c.CustomerOrderFormComponent)
    // If your component file is named place-order.component.ts, use:
    // loadComponent: () => import('./place-order/place-order.component').then(c => c.PlaceOrderComponent)
  },
  // Default route within the 'customer' section
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
