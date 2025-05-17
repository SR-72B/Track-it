// src/app/app-routing.module.ts
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './auth/auth.guard';
import { RetailerGuard } from './auth/retailer.guard';
import { CustomerGuard } from './auth/customer.guard';
import { SubscriptionGuard } from './auth/subscription.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: '',
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'retailer',
    loadChildren: () => import('./retailer/retailer.module').then(m => m.RetailerModule),
    canActivate: [AuthGuard, RetailerGuard, SubscriptionGuard]
  },
  {
    path: 'customer',
    loadChildren: () => import('./customer/customer.module').then(m => m.CustomerModule),
    canActivate: [AuthGuard, CustomerGuard]
  },
  {
    path: 'communication',
    loadChildren: () => import('./communication/communication.module').then(m => m.CommunicationModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'payment',
    loadChildren: () => import('./payment/payment.module').then(m => m.PaymentModule),
    canActivate: [AuthGuard, RetailerGuard]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
