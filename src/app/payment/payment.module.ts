// src/app/payment/payment.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { SubscriptionComponent } from './subscription/subscription.component';
import { SubscriptionDetailsComponent } from './subscription/subscription-details.component';

const routes: Routes = [
  { path: 'subscription', component: SubscriptionComponent },
  { path: 'subscription-details', component: SubscriptionDetailsComponent }
];

@NgModule({
  declarations: [
    SubscriptionComponent,
    SubscriptionDetailsComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class PaymentModule { }