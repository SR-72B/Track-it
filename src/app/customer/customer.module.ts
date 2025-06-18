// src/app/customer/customer.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { CustomerDashboardComponent } from './dashboard/customer-dashboard.component';
import { AvailableFormsComponent } from './available-forms/available-forms.component';
import { PlaceOrderComponent } from './place-order/place-order.component';
import { CustomerOrderListComponent } from './order-list/customer-order-list.component';
import { CustomerOrderDetailComponent } from './order-detail/customer-order-detail.component';

const routes: Routes = [
  { path: 'dashboard', component: CustomerDashboardComponent },
  { path: 'forms', component: AvailableFormsComponent },
  { path: 'place-order/:id', component: PlaceOrderComponent },
  { path: 'orders', component: CustomerOrderListComponent },
  { path: 'orders/:id', component: CustomerOrderDetailComponent },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    CustomerDashboardComponent,
    AvailableFormsComponent,
    PlaceOrderComponent,
    CustomerOrderListComponent,
    CustomerOrderDetailComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class CustomerModule { }