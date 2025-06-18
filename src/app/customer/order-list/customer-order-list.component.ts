// src/app/customer/order-list/customer-order-list.component.ts
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router'; // Added RouterModule
import { CommonModule } from '@angular/common'; // Added CommonModule
import { LoadingController, IonicModule } from '@ionic/angular'; // Added IonicModule

import { AuthService, User } from '../../auth/auth.service'; // Import User interface
import { CustomerOrderService } from '../order/customer-order.service';
import { Order } from '../../retailer/order-management/order.service';
import { Observable, of } from 'rxjs'; // Added of
import { map, first, finalize, catchError } from 'rxjs/operators'; // Added catchError

@Component({
  selector: 'app-customer-order-list',
  templateUrl: './customer-order-list.component.html', // Ensure this file exists
  styleUrls: ['./customer-order-list.component.scss'],   // Ensure this file exists
  standalone: true, // Mark component as standalone
  imports: [
    CommonModule,     // For *ngIf, *ngFor, async pipe, etc.
    IonicModule,      // For Ionic components (ion-segment, ion-list, ion-item, ion-spinner, etc.)
    RouterModule      // For routerLink (if used in the template)
  ]
})
export class CustomerOrderListComponent implements OnInit {
  orders$: Observable<Order[]> = of([]); // Initialize with an empty observable
  isLoading = true;
  segment = 'all'; // Default segment
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    private customerOrderService: CustomerOrderService,
    private router: Router,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.loadOrders();
  }

  async loadOrders(event?: any) { // Added event for ion-refresher
    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    // Only show loader if not triggered by refresher
    if (!event) {
      loader = await this.loadingController.create({
        message: 'Loading orders...',
        spinner: 'crescent',
        backdropDismiss: false
      });
      await loader.present();
    }

    this.authService.currentUser$.pipe(
      first((user): user is User => user !== null && user.uid !== undefined), // Take first valid user & complete
      catchError(error => {
        console.error('Error fetching current user for orders:', error);
        this.errorMessage = 'Could not load user data to fetch orders.';
        this.orders$ = of([]);
        return of(null); // Propagate null to indicate user fetch failure
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loader) {
          await loader.dismiss().catch(e => console.warn('Error dismissing loader:', e));
        }
        if (event) {
          event.target.complete(); // Complete ion-refresher animation
        }
      })
    ).subscribe(user => {
      if (user) { // user is User here due to the 'first' operator's predicate
        this.orders$ = this.customerOrderService.getCustomerOrders(user.uid).pipe(
          map(orders => {
            if (this.segment === 'all') {
              return orders;
            }
            return orders.filter(order => order.status === this.segment);
          }),
          catchError(err => {
            console.error('Error loading customer orders:', err);
            this.errorMessage = 'Failed to load your orders. Please try again.';
            return of([]); // Return empty array on error
          })
          // isLoading and loader dismissal are handled by the outer finalize
        );
      } else {
        // This case is primarily hit if catchError in currentUser$ returned null
        if (!this.errorMessage) { // Avoid overwriting more specific error
             this.errorMessage = 'User not available. Cannot load orders.';
        }
        this.orders$ = of([]);
      }
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
    // Assuming you have a tracking page/component
    if (orderId) {
      this.router.navigate(['/customer/tracking', orderId]); // Adjust route as needed
    } else {
      console.error('Cannot track order: Order ID is missing.');
    }
  }

  formatDate(dateInput: any): string {
    if (!dateInput) return '';
    let d: Date;
    // Handle Firebase Timestamp
    if (dateInput && typeof dateInput.seconds === 'number' && typeof dateInput.nanoseconds === 'number') {
      d = new Date(dateInput.seconds * 1000);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput); // Attempt to parse if string or number
    }

    if (isNaN(d.getTime())) {
      console.warn('Invalid date input for formatDate in order list:', dateInput);
      return 'Invalid Date';
    }
    return d.toLocaleDateString(); // Or your preferred format
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'primary';
      case 'shipped': return 'tertiary'; // Or another color like 'secondary'
      case 'delivered': return 'success';
      case 'cancelled': return 'danger';
      case 'completed': return 'success'; // 'completed' often means the same as 'delivered'
      default: return 'medium';
    }
  }

  // For ion-refresher
  doRefresh(event: any) {
    this.loadOrders(event);
  }
}
