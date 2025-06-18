// src/app/customer/dashboard/customer-dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core'; // Added OnDestroy
import { Router, RouterModule } from '@angular/router'; // Added RouterModule
import { CommonModule } from '@angular/common'; // Added CommonModule
import { IonicModule } from '@ionic/angular'; // Added IonicModule

import { Observable, Subscription, of, forkJoin } from 'rxjs'; // Added of, forkJoin
import { map, first, filter, catchError, finalize } from 'rxjs/operators'; // Added catchError, finalize

import { AuthService, User } from '../../auth/auth.service'; // Ensure path is correct
import { Order } from '../../retailer/order-management/order.service'; // Ensure Order is defined and path is correct
import { OrderForm } from '../../retailer/form-builder/form-builder.service'; // Ensure OrderForm is defined and path is correct
import { CustomerOrderService } from '../order/customer-order.service';

@Component({
  selector: 'app-customer-dashboard',
  templateUrl: './customer-dashboard.component.html', // Ensure this file exists
  styleUrls: ['./customer-dashboard.component.scss'],   // Ensure this file exists
  standalone: true, // Mark component as standalone
  imports: [
    CommonModule,     // For *ngIf, *ngFor, async pipe, etc.
    IonicModule,      // For Ionic components (ion-card, ion-list, ion-spinner, ion-button, etc.)
    RouterModule      // For routerLink (if used in the template)
  ]
})
export class CustomerDashboardComponent implements OnInit, OnDestroy {
  user$: Observable<User | null>;
  recentOrders$: Observable<Order[]> = of([]); // Initialize with empty array observable
  availableForms$: Observable<OrderForm[]> = of([]); // Initialize with empty array observable
  isLoading = true;
  errorMessage: string | null = null;

  private dashboardDataSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private customerOrderService: CustomerOrderService,
    private router: Router
  ) {
    this.user$ = this.authService.currentUser$;
  }

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.isLoading = true;
    this.errorMessage = null;

    if (this.dashboardDataSubscription) {
      this.dashboardDataSubscription.unsubscribe();
    }
    
    this.dashboardDataSubscription = this.authService.currentUser$.pipe(
      first((user): user is User => user !== null && user.uid !== undefined), // Take first valid user & complete
      catchError(error => {
        console.error("Error fetching current user:", error);
        this.errorMessage = 'Failed to load user data. Please try again later.';
        this.isLoading = false;
        return of(null); // Propagate null to stop further processing if critical
      })
    ).subscribe(user => {
      if (user) {
        // User is guaranteed to be User (not null) and have a uid here due to the 'first' operator's predicate
        const recentOrdersObs = this.customerOrderService.getCustomerOrders(user.uid).pipe(
          map(orders => orders.slice(0, 5)),
          catchError(err => {
            console.error('Error loading recent orders:', err);
            // Optionally set a specific error message for orders
            return of([]); // Return empty array on error for this specific stream
          })
        );

        const availableFormsObs = this.customerOrderService.getActiveForms().pipe(
          map(forms => forms.slice(0, 3)),
          catchError(err => {
            console.error('Error loading available forms:', err);
            // Optionally set a specific error message for forms
            return of([]); // Return empty array on error for this specific stream
          })
        );

        // Use forkJoin to wait for both observables to emit at least one value (or complete)
        // Note: forkJoin completes when all source observables complete.
        // If these are long-lived streams, consider combineLatest or switchMap for a different behavior.
        forkJoin([recentOrdersObs, availableFormsObs]).pipe(
          finalize(() => {
            this.isLoading = false;
          })
        ).subscribe(([recentOrders, availableForms]) => {
          this.recentOrders$ = of(recentOrders); // Re-assign to keep template simple with async pipe
          this.availableForms$ = of(availableForms); // Re-assign
          if (!recentOrders.length && !availableForms.length && !this.errorMessage) {
            // Check if both are empty and no general error occurred yet
          }
        }, forkJoinError => {
            console.error("Error in forkJoin for dashboard data:", forkJoinError);
            if(!this.errorMessage) this.errorMessage = 'Could not load all dashboard data.';
            this.isLoading = false;
        });

      } else {
        // This block might not be reached if `first` predicate ensures user is not null,
        // but it's good for defensive coding if the predicate was different.
        if (!this.errorMessage) { // Only set if no prior error was set
          this.errorMessage = 'User not available for loading dashboard data.';
        }
        this.isLoading = false;
        this.recentOrders$ = of([]);
        this.availableForms$ = of([]);
      }
    });
  }

  viewAllOrders() {
    this.router.navigate(['/customer/orders']);
  }

  viewOrder(orderId: string) {
    this.router.navigate(['/customer/orders', orderId]);
  }

  viewAllForms() {
    this.router.navigate(['/customer/forms']);
  }

  placeOrder(formId: string) {
    // The route was '/customer/forms/:formId' in customer.routes.ts
    // If you have a specific "place order" page that takes a form ID, this is fine.
    // Otherwise, it might be router.navigate(['/customer/forms', formId]);
    this.router.navigate(['/customer/forms', formId]);
  }

  formatDate(dateInput: any): string {
    if (!dateInput) return '';
    let date: Date;

    if (dateInput && typeof dateInput.toDate === 'function') { // Firebase Timestamp
      date = dateInput.toDate();
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return date.toLocaleDateString(); // Or any other format you prefer
  }

  ngOnDestroy() {
    if (this.dashboardDataSubscription) {
      this.dashboardDataSubscription.unsubscribe();
    }
  }
}
