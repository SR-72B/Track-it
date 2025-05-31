// src/app/customer/order-tracking/order-tracking.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoadingController, IonicModule } from '@ionic/angular';

import { CustomerOrderService } from '../order/customer-order.service';
import { Order, OrderUpdate } from '../../retailer/order-management/order.service'; // Ensure path is correct
import { Observable, Subscription, of, firstValueFrom } from 'rxjs';
import { map, finalize, tap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-order-tracking',
  templateUrl: './order-tracking.component.html', // Ensure this file exists
  styleUrls: ['./order-tracking.component.scss'],   // Ensure this file exists
  standalone: true, // Mark component as standalone
  imports: [
    CommonModule,     // For *ngIf, *ngFor, async pipe, etc.
    IonicModule,      // For Ionic components (ion-progress-bar, ion-list, ion-item, ion-icon, ion-spinner etc.)
    RouterModule      // For routerLink (if used in the template)
  ]
})
export class OrderTrackingComponent implements OnInit, OnDestroy {
  orderId: string | null = null;
  order$: Observable<Order | null | undefined> = of(undefined);
  updates$: Observable<OrderUpdate[]> = of([]);
  isLoading = true;
  errorMessage: string | null = null;

  statusSteps = [
    { status: 'pending', label: 'Pending' },
    { status: 'processing', label: 'Processing' },
    { status: 'shipped', label: 'Shipped' },
    { status: 'delivered', label: 'Delivered' }
    // 'cancelled' is handled as a special case
  ];
  currentStepIndex = 0;

  private routeSubscription: Subscription | undefined;
  // Removed manual orderSubscription as order$ is intended for async pipe

  constructor(
    private route: ActivatedRoute,
    private customerOrderService: CustomerOrderService,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.orderId = id;
        this.loadOrderDetails();
      } else {
        console.error('Order ID not found in route parameters for tracking.');
        this.errorMessage = 'Order ID is missing. Cannot track order.';
        this.isLoading = false;
      }
    });
  }

  async loadOrderDetails(refresherEvent?: any) {
    if (!this.orderId) {
      this.isLoading = false;
      this.errorMessage = 'Cannot load order tracking: Order ID is missing.';
      if (refresherEvent) refresherEvent.target.complete();
      console.error(this.errorMessage);
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
      loader = await this.loadingController.create({
        message: 'Loading order tracking...',
        spinner: 'crescent',
      });
      await loader.present();
    }

    this.order$ = this.customerOrderService.getOrder(this.orderId).pipe(
      tap(order => {
        if (order) {
          this.currentStepIndex = this.statusSteps.findIndex(step => step.status === order.status);
          if (order.status === 'cancelled') {
            this.currentStepIndex = -1; // Special index for cancelled
          }
          // Mark updates as seen - fire and forget, but log errors
          if (this.orderId) {
            firstValueFrom(this.customerOrderService.markUpdatesSeen(this.orderId))
              .catch(err => console.warn('Failed to mark updates as seen on load:', err));
          }
        } else if (!this.errorMessage) {
            this.errorMessage = "Order not found.";
        }
      }),
      catchError(err => {
        console.error('Error loading order details:', err);
        this.errorMessage = 'Failed to load order details. Please try again.';
        return of(null); // Emit null to indicate error
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loader) {
          await loader.dismiss().catch(e => console.warn("Error dismissing loader:", e));
        }
        if (refresherEvent) {
          refresherEvent.target.complete();
        }
      })
    );

    this.updates$ = this.customerOrderService.getOrderUpdates(this.orderId).pipe(
      map(updates => updates.sort((a, b) => {
        const dateAInput = a.createdAt as any;
        const dateBInput = b.createdAt as any;
        const dateA = new Date(dateAInput?.seconds ? dateAInput.seconds * 1000 : dateAInput);
        const dateB = new Date(dateBInput?.seconds ? dateBInput.seconds * 1000 : dateBInput);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
        return dateB.getTime() - dateA.getTime(); // Descending
      })),
      catchError(err => {
        console.error('Error loading order updates:', err);
        return of([]); // Return empty array on error
      })
    );
  }

  formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';
    let d: Date;
    if (dateInput && typeof dateInput.seconds === 'number' && typeof dateInput.nanoseconds === 'number') {
      d = new Date(dateInput.seconds * 1000);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) {
      console.warn('Invalid date input for formatDate in tracking:', dateInput);
      return 'Invalid Date';
    }
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  getProgressPercentage(currentOrder: Order | null | undefined): number {
    if (!currentOrder || this.currentStepIndex < 0) { // currentStepIndex will be -1 for 'cancelled'
      // If order is cancelled or no order, show 0%
      // If order status is 'delivered', it should be 100%
      if (currentOrder?.status === 'delivered') return 100;
      return 0;
    }
    // If currentStepIndex is out of bounds for statusSteps (should not happen if logic is correct)
    if (this.currentStepIndex >= this.statusSteps.length) return 0;

    const totalSegments = this.statusSteps.length - 1;
    if (totalSegments <= 0) return 100; // If only one step, consider it 100% (or 0% if not yet that step)

    // If current status is 'delivered', it's 100%
    if (this.statusSteps[this.currentStepIndex]?.status === 'delivered') {
        return 100;
    }

    // Small initial progress for the first step ('pending')
    if (this.currentStepIndex === 0 && totalSegments > 0) {
        return 5;
    }

    const progress = (this.currentStepIndex / totalSegments) * 100;
    return Math.min(progress, 100);
  }

  doRefresh(event: any) {
    this.loadOrderDetails(event);
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    // No need to unsubscribe from order$ or updates$ if only used with async pipe in template
  }
}
