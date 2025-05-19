// src/app/retailer/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription, combineLatest, of } from 'rxjs'; // Added Subscription, combineLatest, of
import { map, first, finalize, switchMap, catchError, tap } from 'rxjs/operators'; // Added first, finalize, switchMap, catchError, tap
import { AuthService, User } from '../../auth/auth.service';
import { OrderService, Order } from '../order-management/order.service';
import { FormBuilderService, OrderForm } from '../form-builder/form-builder.service';
import { LoadingController } from '@ionic/angular'; // Import LoadingController

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  user$: Observable<User | null>; // This will be directly from authService
  recentOrders: Order[] = []; // Store recent orders directly
  activeForms: OrderForm[] = [];  // Store active forms directly
  orderCounts: {[key: string]: number} = {
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  };
  isLoading = true;
  private dashboardDataSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private formBuilderService: FormBuilderService,
    private router: Router,
    private loadingController: LoadingController // Inject LoadingController
  ) { }

  ngOnInit() {
    this.user$ = this.authService.currentUser$; // Assign user observable
    this.loadDashboardData();
  }

  async loadDashboardData() {
    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Loading dashboard data...',
      spinner: 'crescent',
      backdropDismiss: false
    });
    await loading.present();

    // Unsubscribe from previous subscription if it exists
    if (this.dashboardDataSubscription) {
      this.dashboardDataSubscription.unsubscribe();
    }

    this.dashboardDataSubscription = this.authService.currentUser$.pipe(
      first(), // Take the first emitted user value and complete
      switchMap(user => {
        const typedUser = user as User | null; // Explicitly type user

        if (typedUser && typedUser.uid) {
          // Define observables for orders and forms
          const ordersData$ = this.orderService.getRetailerOrders(typedUser.uid).pipe(
            tap(orders => { // Use tap for side effects like calculating counts
              this.orderCounts.total = orders.length;
              this.orderCounts.pending = orders.filter(o => o.status === 'pending').length;
              this.orderCounts.processing = orders.filter(o => o.status === 'processing').length;
              this.orderCounts.shipped = orders.filter(o => o.status === 'shipped').length;
              this.orderCounts.delivered = orders.filter(o => o.status === 'delivered').length;
              this.orderCounts.cancelled = orders.filter(o => o.status === 'cancelled').length;
            }),
            map(orders => orders.slice(0, 5)), // Get only the 5 most recent orders for display
            catchError(err => {
              console.error('Error loading recent orders:', err);
              return of([]); // Return empty array on error
            })
          );

          const formsData$ = this.formBuilderService.getRetailerForms(typedUser.uid).pipe(
            map((forms: OrderForm[]) => forms.filter(form => form.active).slice(0, 3)), // Ensure forms is typed
            catchError(err => {
              console.error('Error loading active forms:', err);
              return of([]); // Return empty array on error
            })
          );

          // Use combineLatest to wait for both observables to emit
          return combineLatest([ordersData$, formsData$]);
        } else {
          console.warn('User not logged in or UID missing for dashboard.');
          return of([[], []] as [Order[], OrderForm[]]); // Return observables of empty arrays
        }
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loading) {
          await loading.dismiss();
        }
      })
    ).subscribe(
      ([orders, forms]) => {
        this.recentOrders = orders;
        this.activeForms = forms;
        // isLoading is handled by finalize
      },
      error => {
        console.error('Error loading dashboard data:', error);
        this.recentOrders = []; // Reset on error
        this.activeForms = [];  // Reset on error
        // isLoading is handled by finalize
      }
    );
  }

  viewAllOrders() {
    this.router.navigate(['/retailer/orders']);
  }

  viewOrder(orderId: string) {
    if (orderId) {
      this.router.navigate(['/retailer/orders', orderId]);
    }
  }

  viewAllForms() {
    this.router.navigate(['/retailer/forms']);
  }

  editForm(formId: string) {
    if (formId) {
      this.router.navigate(['/retailer/forms/edit', formId]);
    }
  }

  createForm() {
    this.router.navigate(['/retailer/forms/create']);
  }

  /**
   * Formats a date input into a readable string (Date part only).
   * Handles Firebase Timestamps, JavaScript Date objects, and date strings/numbers.
   * @param dateInput The date to format.
   * @returns A formatted date string or a placeholder for invalid/missing dates.
   */
  formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';

    let d: Date;
    // Check if it's a Firebase Timestamp object
    if (dateInput && typeof dateInput.seconds === 'number' && typeof dateInput.nanoseconds === 'number') {
      d = new Date(dateInput.seconds * 1000);
    }
    // Check if it's already a Date object
    else if (dateInput instanceof Date) {
      d = dateInput;
    }
    // Try to parse if it's a string or number
    else {
      d = new Date(dateInput);
    }

    // Validate the created Date object
    if (isNaN(d.getTime())) {
      console.warn('Invalid date input for formatDate in dashboard:', dateInput);
      return 'Invalid Date';
    }
    return d.toLocaleDateString();
  }

  ngOnDestroy() {
    // Unsubscribe to prevent memory leaks
    if (this.dashboardDataSubscription) {
      this.dashboardDataSubscription.unsubscribe();
    }
  }
}
