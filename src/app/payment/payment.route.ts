// src/app/payment/payment.routes.ts
import { Routes } from '@angular/router';

// Ensure this component is standalone and the import path is correct.
// import { SubscriptionDetailsComponent } from './subscription/subscription-details.component';
// import { SubscriptionComponent } from './subscription-form/subscription.component'; // If you have a separate form

export const PAYMENT_ROUTES: Routes = [
  {
    path: 'subscription-details',
    loadComponent: () => import('./subscription/subscription-details.component').then(c => c.SubscriptionDetailsComponent)
  },
  // Example: If you had a page to manage or change subscription
   {
    path: 'manage-subscription',
    loadComponent: () => import('./manage-subscription/manage-subscription.component').then(c => c.ManageSubscriptionComponent)
   },
  // Default route within the 'payment' section
  {
    path: '',
    redirectTo: 'subscription-details',
    pathMatch: 'full'
  }
];