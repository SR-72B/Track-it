// src/app/customer/available-forms/available-forms.component.ts
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router'; // Added RouterModule
import { CommonModule } from '@angular/common'; // Added CommonModule
import { LoadingController, IonicModule } from '@ionic/angular'; // Added IonicModule
import { Observable, of } from 'rxjs'; // Added of
import { finalize, catchError } from 'rxjs/operators'; // Added catchError

import { OrderForm } from '../../retailer/form-builder/form-builder.service'; // Ensure path is correct
import { CustomerOrderService } from '../order/customer-order.service'; // Ensure path is correct

@Component({
  selector: 'app-available-forms',
  templateUrl: './available-forms.component.html', // Ensure this file exists
  styleUrls: ['./available-forms.component.scss'],   // Ensure this file exists
  standalone: true, // Mark component as standalone
  imports: [
    CommonModule,     // For *ngIf, *ngFor, async pipe, etc.
    IonicModule,      // For Ionic components (ion-list, ion-item, ion-spinner, ion-refresher etc.)
    RouterModule      // For routerLink (if used in the template)
  ]
})
export class AvailableFormsComponent implements OnInit {
  forms$: Observable<OrderForm[]> = of([]); // Initialize with empty observable
  isLoading = true;
  errorMessage: string | null = null;

  constructor(
    private customerOrderService: CustomerOrderService,
    private router: Router,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.loadForms();
  }

  async loadForms(event?: any) { // Added event for ion-refresher
    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    // Only show loader if not triggered by refresher
    if (!event) {
      loader = await this.loadingController.create({
        message: 'Loading available forms...',
        spinner: 'crescent'
      });
      await loader.present();
    }

    this.forms$ = this.customerOrderService.getActiveForms().pipe(
      finalize(() => {
        this.isLoading = false;
        if (loader) {
          loader.dismiss().catch(e => console.warn('Error dismissing loader:', e));
        }
        if (event) {
          event.target.complete(); // Complete ion-refresher animation
        }
      }),
      catchError(err => {
        console.error('Error loading available forms:', err);
        this.errorMessage = 'Failed to load forms. Please try again later.';
        return of([]); // Return an empty array on error to clear previous data
      })
    );
  }

  openForm(formId: string) {
    if (formId) {
      // The route defined in customer.routes.ts for filling a form was '/customer/forms/:formId'
      this.router.navigate(['/customer/forms', formId]);
    } else {
      console.error('Cannot open form: Form ID is missing.');
      // Optionally show a toast or alert
    }
  }

  // For ion-refresher
  doRefresh(event: any) {
    this.loadForms(event);
  }
}


