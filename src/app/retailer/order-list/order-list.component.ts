// src/app/retailer/order-list/order-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Observable, Subscription, of } from 'rxjs';
import { map, first, filter, catchError, switchMap, tap } from 'rxjs/operators'; // 'tap' is now included
import { AuthService, User } from '../../auth/auth.service';
import { OrderService, Order } from '../order-management/order.service';

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.scss']
})
export class OrderListComponent implements OnInit, OnDestroy {
  orders$: Observable<Order[]>;
  isLoading = true;
  segment = 'all'; // Default segment

  // ngOnDestroy is good practice if you have any manual subscriptions,
  // but if orders$ is only consumed by async pipe, this component might not need manual unsubscription.
  // However, keeping it for good measure or if other subscriptions are added later.
  private componentSubscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.isLoading = true;
    this.orders$ = this.authService.currentUser$.pipe(
        filter((user): user is User => !!user), // Ensure user is not null and type guard
        first(), // Take the first emitted non-null user and complete
        switchMap(user => { // user here is type User
            // Removed redundant !user check as filter handles it.
            return this.orderService.getRetailerOrders(user.uid).pipe(
                map(orders => {
                    if (this.segment !== 'all') {
                        return orders.filter(order => order.status === this.segment);
                    }
                    return orders;
                }),
                catchError(error => {
                    console.error('Error loading orders:', error);
                    this.alertController.create({
                        header: 'Error',
                        message: 'Could not load orders. Please try again later.',
                        buttons: ['OK']
                    }).then(alert => alert.present());
                    return of([]); // Return an empty array on error
                })
            );
        }),
        tap(() => {
            this.isLoading = false; // Set isLoading to false after data is processed or error in inner pipe
            console.log('Finished loading orders, isLoading:', this.isLoading);
        }),
        catchError(authError => { // Catch errors from the authService.currentUser$ part of the stream
            console.error('Error in user authentication stream for orders:', authError);
            this.isLoading = false;
            this.alertController.create({
                header: 'Authentication Error',
                message: 'Could not retrieve user information to load orders.',
                buttons: ['OK']
            }).then(alert => alert.present());
            return of([]);
        })
    );
  }

  segmentChanged(event: any) {
    this.segment = event.detail.value;
    this.loadOrders(); // Reload orders when segment changes
  }

  viewOrder(orderId: string) {
    this.router.navigate(['/retailer/orders', orderId]);
  }

  formatDate(dateInput: any): string {
    if (!dateInput) return '';
    
    // Handle both Firebase Timestamp (if it has toDate method) and JS Date objects
    const d = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
    return d.toLocaleDateString(); // Or any other formatting you prefer
  }

  ngOnDestroy() {
    // If you assign this.orders$ and use async pipe, manual unsubscription for it isn't strictly needed.
    // However, if you had other manual .subscribe() calls, you'd add them to componentSubscriptions.
    this.componentSubscriptions.unsubscribe();
  }
}
