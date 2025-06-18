// src/app/payment/payment.routes.ts
import { Routes } from '@angular/router';

// Ensure the components linked below are standalone and their import paths are correct.

export const PAYMENT_ROUTES: Routes = [
  {
    path: 'subscription-details',
    loadComponent: () => import('./subscription/subscription-details.component').then(c => c.SubscriptionDetailsComponent)
    // Assumes SubscriptionDetailsComponent is in './subscription/subscription-details.component.ts'
  },
  {
    path: 'manage-subscription',
    loadComponent: () => import('./manage-subscription/manage-subscription.component').then(c => c.ManageSubscriptionComponent)
    // Assumes ManageSubscriptionComponent is in './manage-subscription/manage-subscription.component.ts'
  },
  // Default route within the 'payment' section
  {
    path: '',
    redirectTo: 'subscription-details', // Default to showing subscription details
    pathMatch: 'full'
  }
];
