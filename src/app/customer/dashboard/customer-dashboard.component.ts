// src/app/customer/dashboard/customer-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs'; // Added Subscription
import { map, first, filter, switchMap, take } from 'rxjs/operators'; // Added first, filter, switchMap, take
import { AuthService, User } from '../../auth/auth.service';
import { Order } from '../../retailer/order-management/order.service'; // Assuming Order is correctly defined here
import { OrderForm } from '../../retailer/form-builder/form-builder.service'; // Assuming OrderForm is correctly defined here
import { CustomerOrderService } from '../order/customer-order.service';

@Component({
  selector: 'app-customer-dashboard',
  templateUrl: './customer-dashboard.component.html',
  styleUrls: ['./customer-dashboard.component.scss']
})
export class CustomerDashboardComponent implements OnInit {
  user$: Observable<User | null>;
  recentOrders$: Observable<Order[]>;
  availableForms$: Observable<OrderForm[]>;
  isLoading = true;

  private dashboardDataSubscription: Subscription | null = null; // To manage subscription

  constructor(
    private authService: AuthService,
    private customerOrderService: CustomerOrderService,
    private router: Router
  ) { }

  ngOnInit() {
    this.user$ = this.authService.currentUser$; // Expose currentUser$ directly for async pipe if needed
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.isLoading = true;

    // Unsubscribe from previous subscription if it exists
    if (this.dashboardDataSubscription) {
      this.dashboardDataSubscription.unsubscribe();
    }
    
    this.dashboardDataSubscription = this.authService.currentUser$.pipe(
      filter((user): user is User => user !== null), // Ensure user is not null and type guard it to User
      first() // Take the first emitted non-null user and complete
    ).subscribe(user => {
      // 'user' here is now guaranteed to be of type User (not User | null)
      // So, user.uid will be accessible without error.
      
      // Get recent orders
      this.recentOrders$ = this.customerOrderService.getCustomerOrders(user.uid).pipe(
        map(orders => {
          // Get only the 5 most recent orders
          return orders.slice(0, 5);
        }),
        // isLoading should be set to false after both observables have emitted or an error occurs.
        // For simplicity, we'll set it in the final observable or use a forkJoin/combineLatest approach
        // if you want to wait for multiple async operations to complete.
        // For now, moving isLoading to the end of this subscription.
      );
      
      // Get available forms
      this.availableForms$ = this.customerOrderService.getActiveForms().pipe(
        map(forms => {
          return forms.slice(0, 3);
        })
      );

      // Assuming both recentOrders$ and availableForms$ will be subscribed to in the template via async pipe.
      // If you need to set isLoading after both are "done" (which is tricky with async pipe),
      // you might need a more complex setup or set isLoading based on their emission.
      // For now, let's assume the main loading is for the user data fetch.
      this.isLoading = false; 

    }, error => { // Handle potential error from currentUser$ (e.g., if authService itself has an issue)
        console.error("Error loading user data for dashboard:", error);
        this.isLoading = false;
        // Optionally navigate away or show an error message
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
    this.router.navigate(['/customer/place-order', formId]);
  }

  formatDate(dateInput: any): string { // Changed 'date: any' to 'dateInput: any' to avoid conflict
    if (!dateInput) return '';
    
    const d = new Date(dateInput.seconds ? dateInput.seconds * 1000 : dateInput);
    return d.toLocaleDateString();
  }

  // It's good practice to unsubscribe from manual subscriptions when the component is destroyed
  ngOnDestroy() {
    if (this.dashboardDataSubscription) {
      this.dashboardDataSubscription.unsubscribe();
    }
  }
}