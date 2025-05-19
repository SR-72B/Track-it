// src/app/customer/order-list/customer-order-list.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { AuthService, User } from '../../auth/auth.service'; // Import User interface
import { CustomerOrderService } from '../order/customer-order.service';
import { Order } from '../../retailer/order-management/order.service';
import { Observable } from 'rxjs';
import { map, first, finalize } from 'rxjs/operators'; // Import 'first' and 'finalize'

@Component({
  selector: 'app-customer-order-list',
  templateUrl: './customer-order-list.component.html',
  styleUrls: ['./customer-order-list.component.scss']
})
export class CustomerOrderListComponent implements OnInit {
  orders$: Observable<Order[]>;
  isLoading = true;
  segment = 'all'; // Default segment

  constructor(
    private authService: AuthService,
    private customerOrderService: CustomerOrderService,
    private router: Router,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.loadOrders();
  }

  async loadOrders() {
    this.isLoading = true; // Set loading true at the beginning
    const loading = await this.loadingController.create({
      message: 'Loading orders...',
      spinner: 'crescent',
      backdropDismiss: false
    });
    await loading.present();

    // Use first() to take the first emission (current user state) and complete.
    // Cast the user to your User type (or a type that includes uid).
    this.authService.currentUser$.pipe(
      first(), // Ensures the subscription automatically unsubscribes after the first value.
      finalize(async () => { // Ensure loading is dismissed regardless of success or error
        this.isLoading = false;
        if (loading) {
          await loading.dismiss();
        }
      })
    ).subscribe(user => {
      const typedUser = user as User; // Cast user to the User type

      if (typedUser && typedUser.uid) {
        this.orders$ = this.customerOrderService.getCustomerOrders(typedUser.uid).pipe(
          map(orders => {
            // Filter orders based on the selected segment
            if (this.segment === 'all') {
              return orders; // Return all orders if segment is 'all'
            }
            return orders.filter(order => order.status === this.segment);
          })
          // No need for separate finalize here, as the outer finalize handles loading dismissal
        );
      } else {
        console.warn('User not logged in or UID missing. Cannot load orders.');
        this.orders$ = new Observable<Order[]>(observer => observer.next([])); // Emit empty array
        // isLoading and loading dismissal are handled by the finalize operator above.
      }
    }, error => {
      console.error('Error getting current user:', error);
      this.orders$ = new Observable<Order[]>(observer => observer.next([])); // Emit empty array on error
      // isLoading and loading dismissal are handled by the finalize operator.
    });
  }

  segmentChanged(event: any) {
    this.segment = event.detail.value;
    this.loadOrders(); // Reload orders when segment changes
  }

  viewOrderDetails(orderId: string) {
    if (orderId) {
      this.router.navigate(['/customer/orders', orderId]);
    } else {
      console.error('Cannot view order details: Order ID is missing.');
    }
  }

  trackOrder(orderId: string) {
    if (orderId) {
      this.router.navigate(['/customer/tracking', orderId]);
    } else {
      console.error('Cannot track order: Order ID is missing.');
    }
  }

  /**
   * Formats a date input into a readable string (Date part only).
   * Handles Firebase Timestamps, JavaScript Date objects, and date strings/numbers.
   * @param dateInput The date to format.
   * @returns A formatted date string or an empty string for invalid/missing dates.
   */
  formatDate(dateInput: any): string {
    if (!dateInput) return '';

    let d: Date;
    if (dateInput && typeof dateInput.seconds === 'number' && typeof dateInput.nanoseconds === 'number') {
      d = new Date(dateInput.seconds * 1000);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput);
    }

    if (isNaN(d.getTime())) {
      console.warn('Invalid date input for formatDate in order list:', dateInput);
      return 'Invalid Date';
    }
    return d.toLocaleDateString();
  }

  /**
   * Returns a color string based on the order status for styling purposes.
   * @param status The status of the order.
   * @returns A string representing the color.
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'primary';
      case 'shipped': return 'tertiary';
      case 'delivered': return 'success';
      case 'cancelled': return 'danger';
      case 'completed': return 'success'; // Added completed as success
      default: return 'medium';
    }
  }
}
