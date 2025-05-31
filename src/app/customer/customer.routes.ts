// src/app/customer/customer.routes.ts
import { Routes } from '@angular/router';

// Assuming these components are or will be standalone:
// import { CustomerDashboardComponent } from './dashboard/customer-dashboard.component';
// import { CustomerOrderListComponent } from './order-list/customer-order-list.component';
// import { CustomerOrderDetailComponent } from './order-detail/customer-order-detail.component';
// import { AvailableFormsComponent } from './available-forms/available-forms.component'; // For listing forms
// import { CustomerOrderFormComponent } from './order-form/customer-order-form.component'; // For filling a specific form

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
    path: 'orders/:id', // :id would be the orderId
    loadComponent: () => import('./order-detail/customer-order-detail.component').then(c => c.CustomerOrderDetailComponent)
  },
  {
    path: 'forms', // This path could list available forms for the customer to place an order
    loadComponent: () => import('./available-forms/available-forms.component').then(c => c.AvailableFormsComponent)
    // OR if '/forms' directly goes to a specific form or a creation process, adjust accordingly.
    // The 'Place Order' menu item in your app.component pointed to /customer/forms
  },
  {
    path: 'forms/:formId', // Route to fill out a specific order form
    loadComponent: () => import('./order-form/customer-order-form.component').then(c => c.CustomerOrderFormComponent)
  },
  // Default route within the 'customer' section
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
