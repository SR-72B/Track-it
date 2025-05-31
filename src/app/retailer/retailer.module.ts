// src/app/retailer/retailer.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { DashboardComponent } from './dashboard/dashboard.component';
import { FormBuilderComponent } from './form-builder/form-builder.component'; // Assuming this is a UI component
import { FormListComponent } from './form-list/form-list.component';
import { OrderListComponent } from './order-list/order-list.component';
import { OrderDetailComponent } from './order-detail/order-detail.component';

const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'forms', component: FormListComponent },
  { path: 'forms/create', component: FormBuilderComponent }, // This should be a UI component
  { path: 'forms/edit/:id', component: FormBuilderComponent }, // This should be a UI component
  { path: 'orders', component: OrderListComponent },
  { path: 'orders/:id', component: OrderDetailComponent },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    DashboardComponent,
    FormBuilderComponent, // Make sure FormBuilderComponent is the UI component, not the service
    FormListComponent,
    OrderListComponent,
    OrderDetailComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
  // Services like FormBuilderService are typically provided in 'root' (in the @Injectable decorator)
  // or in a providers array if you need to scope them differently. They are not usually declared or exported here.
})
export class RetailerModule { }