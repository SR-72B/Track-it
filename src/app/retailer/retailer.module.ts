// src/app/retailer/retailer.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { DashboardComponent } from './dashboard/dashboard.component';
import { FormBuilderComponent } from './form-builder/form-builder.component';
import { FormListComponent } from './form-list/form-list.component';
import { OrderListComponent } from './order-list/order-list.component';
import { OrderDetailComponent } from './order-detail/order-detail.component';

const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'forms', component: FormListComponent },
  { path: 'forms/create', component: FormBuilderComponent },
  { path: 'forms/edit/:id', component: FormBuilderComponent },
  { path: 'orders', component: OrderListComponent },
  { path: 'orders/:id', component: OrderDetailComponent },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    // Remove standalone components from declarations
    // DashboardComponent,
    // FormBuilderComponent,
    // FormListComponent,
    // OrderListComponent,
    // OrderDetailComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    // Add standalone components to imports instead
    DashboardComponent,
    FormBuilderComponent,
    FormListComponent,
    OrderListComponent,
    OrderDetailComponent
  ],
  exports: [RouterModule]
})
export class RetailerModule { }
