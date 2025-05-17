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
    DashboardComponent,
    FormBuilderComponent,
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
})
export class RetailerModule { }
 from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'radio' | 'upload';
  label: string;
  required: boolean;
  options?: string[]; // For radio buttons
  description?: string;
}

export interface OrderForm {
  id: string;
  retailerId: string;
  title: string;
  description?: string;
  fields: FormField[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  allowFileUpload: boolean;
  allowedFileTypes: string[]; // e.g., ['png', 'heic']
  cancellationPolicy?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FormBuilderService {
  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService
  ) {}

  createOrderForm(form: Partial<OrderForm>): Promise<string> {
    const formId = this.firestore.createId();
    const now = new Date();
    
    const orderForm: OrderForm = {
      id: formId,
      retailerId: form.retailerId || '',
      title: form.title || 'New Order Form',
      description: form.description || '',
      fields: form.fields || [],
      active: form.active !== undefined ? form.active : true,
      createdAt: now,
      updatedAt: now,
      allowFileUpload: form.allowFileUpload || false,
      allowedFileTypes: form.allowedFileTypes || ['png', 'heic'],
      cancellationPolicy: form.cancellationPolicy || 'Orders can be cancelled within 24 hours of submission.'
    };
    
    return this.firestore.collection('orderForms').doc(formId).set(orderForm)
      .then(() => formId);
  }

  updateOrderForm(formId: string, updates: Partial<OrderForm>): Promise<void> {
    updates.updatedAt = new Date();
    return this.firestore.collection('orderForms').doc(formId).update(updates);
  }

  getOrderForm(formId: string): Observable<OrderForm> {
    return this.firestore.collection('orderForms').doc<OrderForm>(formId).valueChanges()
      .pipe(
        map(form => {
          if (!form) throw new Error('Form not found');
          return form;
        })
      );
  }

  getRetailerForms(retailerId: string): Observable<OrderForm[]> {
    return this.firestore.collection<OrderForm>('orderForms', ref => 
      ref.where('retailerId', '==', retailerId).orderBy('createdAt', 'desc')
    ).valueChanges();
  }

  deleteOrderForm(formId: string): Promise<void> {
    return this.firestore.collection('orderForms').doc(formId).delete();
  }
}
