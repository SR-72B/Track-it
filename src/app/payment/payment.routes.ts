// src/app/payment/payment.routes.ts
import { Routes } from '@angular/router';

export const PAYMENT_ROUTES: Routes = [
  { path: '', redirectTo: 'subscription', pathMatch: 'full' },
  {
    path: 'subscription',
    loadComponent: () => import('./subscription/subscription.component').then(c => c.SubscriptionComponent)
  },
  {
    path: 'subscription-details',
    loadComponent: () => import('./subscription/subscription-details.component').then(c => c.SubscriptionDetailsComponent)
  },
  {
    path: 'manage-subscription',
    loadComponent: () => import('./manage-subscription/manage-subscription.component').then(c => c.ManageSubscriptionComponent)
  },
  {
    path: 'billing',
    loadComponent: () => import('./billing/billing.component').then(c => c.BillingComponent)
  },
  {
    path: 'payment-methods',
    loadComponent: () => import('./payment-method/payment-method.component').then(c => c.PaymentMethodsComponent)
  }
];
