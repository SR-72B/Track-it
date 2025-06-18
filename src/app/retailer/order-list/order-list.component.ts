// src/app/retailer/order-list/order-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router'; // Added RouterModule
import { CommonModule } from '@angular/common'; // Added CommonModule
import { AlertController, LoadingController, IonicModule, ToastController } from '@ionic/angular'; // Added IonicModule, ToastController
import { Observable, Subscription, of } from 'rxjs';
import { map, first, filter, catchError, switchMap, tap, finalize } from 'rxjs/operators';

import { AuthService, User } from '../../auth/auth.service'; // Ensure User is exported
import { OrderService, Order } from '../order-management/order.service'; // Ensure Order is exported

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html', // Ensure this file exists
  styleUrls: ['./order-list.component.scss'],   // Ensure this file exists
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule // For routerLink if used in template
  ]
})
export class OrderListComponent implements OnInit, OnDestroy {
  orders$: Observable<Order[]> = of([]); // Initialize with an empty observable
  isLoading = true;
  segment = 'all'; // Default segment
  errorMessage: string | null = null;

  private currentUser: User | null = null;
  private authSubscription: Subscription | undefined;
  // No need for componentSubscriptions if orders$ is the only main observable and used with async pipe

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController // Added for non-critical messages
  ) {}

  ngOnInit() {
    // Subscribe to user changes to reload orders if the user changes (e.g., re-login)
    // or to get the initial user.
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.uid) {
        this.loadOrders();
      } else {
        this.isLoading = false;
        this.orders$ = of([]);
        this.errorMessage = "Please log in to view orders.";
      }
    });
  }

  async loadOrders(refresherEvent?: any) {
    if (!this.currentUser || !this.currentUser.uid) {
      this.isLoading = false;
      this.errorMessage = "User not authenticated. Cannot load orders.";
      if (refresherEvent) refresherEvent.target.complete();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    // Show loader only for initial load, not for segment changes or manual refresh if handled by ion-refresher
    if (!refresherEvent && this.segment === 'all' && !this.orders$) { // Heuristic for initial load
        // loader = await this.loadingController.create({ message: 'Loading orders...' });
        // await loader.present();
    }

    this.orders$ = this.orderService.getRetailerOrders(this.currentUser.uid).pipe(
      map(orders => {
        if (this.segment !== 'all') {
          return orders.filter(order => order.status === this.segment);
        }
        // Sort all orders by date descending before returning
        return orders.sort((a, b) => {
            const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0);
            const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0);
            return dateB.getTime() - dateA.getTime();
        });
      }),
      finalize(async () => {
        this.isLoading = false;
        // if (loader) await loader.dismiss().catch(e => console.warn("Loader dismiss error", e));
        if (refresherEvent) {
          refresherEvent.target.complete();
        }
      }),
      catchError(error => {
        console.error('Error loading orders:', error);
        this.errorMessage = 'Could not load orders. Please try again later.';
        // No need for alertController here, template can display errorMessage
        return of([]); // Return an empty array on error
      })
    );
  }

  segmentChanged(event: any) {
    this.segment = event.detail.value;
    if (this.currentUser && this.currentUser.uid) { // Ensure user is still available
        this.loadOrders(); // Reload orders when segment changes
    }
  }

  viewOrder(orderId: string | undefined) { // Allow undefined for safety
    if (orderId) {
      this.router.navigate(['/retailer/orders', orderId]);
    } else {
        console.warn('View order called with undefined orderId');
        this.showToast('Cannot view order details: Order ID is missing.', 'danger');
    }
  }

  formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';
    let d: Date;
    if (dateInput && typeof dateInput.seconds === 'number') { // Firebase Timestamp
      d = new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1000000);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) {
      return 'Invalid Date';
    }
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'primary';
      case 'shipped': return 'tertiary';
      case 'delivered': return 'success';
      case 'cancelled': return 'danger';
      default: return 'medium';
    }
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({ message, duration, color, position: 'top' });
    toast.present();
  }

  // For ion-refresher
  doRefresh(event: any) {
    if (this.currentUser && this.currentUser.uid) {
        this.loadOrders(event);
    } else {
        this.showToast('Please log in to refresh orders.', 'warning');
        if (event) event.target.complete();
    }
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    // If orders$ is only consumed by async pipe, manual unsubscription for it isn't strictly needed.
    // The `first()` operator in the original `loadOrders` would have completed the inner auth stream.
    // The new structure subscribes to currentUser$ for the component's lifetime.
  }
}

