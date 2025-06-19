// src/app/customer/order-tracking/order-tracking.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoadingController, IonicModule } from '@ionic/angular';

import { CustomerOrderService } from '../order/customer-order.service';
import { Order, OrderUpdate } from '../../retailer/order-management/order.service';
import { Observable, Subscription, of, firstValueFrom } from 'rxjs';
import { map, finalize, tap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-order-tracking',
  templateUrl: './order-tracking.component.html',
  styleUrls: ['./order-tracking.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
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
  ];
  currentStepIndex = 0;

  private routeSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private customerOrderService: CustomerOrderService,
    private loadingController: LoadingController,
    private cdr: ChangeDetectorRef
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
        this.cdr.detectChanges();
      }
    });
  }

  async loadOrderDetails(refresherEvent?: any) {
    if (!this.orderId) {
      this.isLoading = false;
      this.errorMessage = 'Cannot load order tracking: Order ID is missing.';
      if (refresherEvent) refresherEvent.target.complete();
      console.error(this.errorMessage);
      this.cdr.detectChanges();
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
          if (order.status === 'cancelled' || order.status === 'failed') {
            this.currentStepIndex = -1; // Special index for cancelled/failed
          }
          if (this.orderId) {
            firstValueFrom(this.customerOrderService.markUpdatesSeen(this.orderId))
              .catch(err => console.warn('Failed to mark updates as seen on load:', err));
          }
        } else if (!this.errorMessage) {
          this.errorMessage = "Order not found.";
        }
        this.cdr.detectChanges();
      }),
      catchError(err => {
        console.error('Error loading order details:', err);
        this.errorMessage = 'Failed to load order details. Please try again.';
        this.cdr.detectChanges();
        return of(null);
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loader) {
          await loader.dismiss().catch(e => console.warn("Error dismissing loader:", e));
        }
        if (refresherEvent) {
          refresherEvent.target.complete();
        }
        this.cdr.detectChanges();
      })
    );

    this.updates$ = this.customerOrderService.getOrderUpdates(this.orderId).pipe(
      map(updates => updates.sort((a, b) => {
        const getMs = (timestamp: any): number => {
          if (!timestamp) return 0;
          if (timestamp instanceof Date) return timestamp.getTime();
          if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000).getTime();
          const d = new Date(timestamp);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getMs(b.createdAt) - getMs(a.createdAt); // Descending
      })),
      catchError(err => {
        console.error('Error loading order updates:', err);
        return of([]);
      })
    );
  }

  formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';
    let d: Date;
    if (dateInput && typeof dateInput.seconds === 'number') {
      d = new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1000000);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput);
    }

    if (isNaN(d.getTime())) {
      console.warn('Invalid date input for formatDate in tracking:', dateInput);
      return 'Invalid Date';
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  getProgressPercentage(currentOrder: Order | null | undefined): number {
    if (!currentOrder || this.currentStepIndex < 0 || currentOrder.status === 'cancelled' || currentOrder.status === 'failed') {
      if (currentOrder?.status === 'delivered' || currentOrder?.status === 'completed') return 100;
      return 0;
    }
    if (this.currentStepIndex >= this.statusSteps.length) return 0;

    const totalSegments = this.statusSteps.length - 1;
    if (totalSegments <= 0) return 100;

    if (this.statusSteps[this.currentStepIndex]?.status === 'delivered') {
      return 100;
    }
    if (this.currentStepIndex === 0 && totalSegments > 0) {
      return 5; // Small initial progress for the first step ('pending')
    }
    const progress = (this.currentStepIndex / totalSegments) * 100;
    return Math.min(progress, 100);
  }

  public getStatusClass(status: string | undefined): string {
    if (!status) return 'status-other';
    switch (status.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'processing': return 'status-processing';
      case 'shipped': return 'status-shipped';
      case 'delivered': return 'status-delivered';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      case 'failed': return 'status-failed';
      default: return 'status-other';
    }
  }

  doRefresh(event: any) {
    this.loadOrderDetails(event);
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }
}
