// src/app/customer/order-detail/customer-order-detail.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'; // Added ChangeDetectorRef
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController, ToastController, IonicModule } from '@ionic/angular';
import { Observable, Subscription, firstValueFrom, of } from 'rxjs';
import { finalize, catchError, tap, filter } from 'rxjs/operators'; // Added filter and tap

import { Order, OrderUpdate } from '../../retailer/order-management/order.service'; // Ensure this path is correct
import { CustomerOrderService } from '../order/customer-order.service'; // Ensure this path is correct

@Component({
  selector: 'app-customer-order-detail',
  templateUrl: './customer-order-detail.component.html',
  styleUrls: ['./customer-order-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class CustomerOrderDetailComponent implements OnInit, OnDestroy {
  orderId: string | null = null;
  orderData$: Observable<{order: Order, updates: OrderUpdate[]} | null > = of(null);
  isLoading = true;
  isCancelling = false;
  errorMessage: string | null = null;

  private routeSubscription: Subscription | undefined;
  // orderDataSubscription is removed as we'll rely on async pipe for the main data flow

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerOrderService: CustomerOrderService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef // Injected ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.orderId = id;
        this.loadOrderDetails(); // Changed from loadOrder to loadOrderDetails for clarity
      } else {
        console.error('Order ID not found in route parameters');
        this.errorMessage = 'Order ID is missing. Cannot display order details.';
        this.isLoading = false;
        this.router.navigate(['/customer/orders']);
      }
    });
  }

  async loadOrderDetails(refresherEvent?: any) {
    if (!this.orderId) {
      this.isLoading = false;
      this.errorMessage = 'Cannot load order: Order ID is missing.';
      if (refresherEvent) refresherEvent.target.complete();
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    let loadingIndicator: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
      loadingIndicator = await this.loadingController.create({
        message: 'Loading order details...',
        spinner: 'crescent',
        backdropDismiss: false
      });
      await loadingIndicator.present();
    }

    this.orderData$ = this.customerOrderService.getOrderWithUpdates(this.orderId).pipe(
      tap(data => { // Use tap for side-effects like logging or simple checks
        if (!data && !this.errorMessage) {
          this.errorMessage = 'Order not found or could not be loaded.';
        }
        // Mark updates as seen after data is loaded (or attempted to load)
        if (this.orderId && data && data.order && !this.errorMessage) {
          firstValueFrom(this.customerOrderService.markUpdatesSeen(this.orderId))
            .catch(error => console.warn('Failed to mark updates as seen:', error));
        }
        this.cdr.detectChanges(); // Ensure UI updates after data emission
      }),
      catchError(err => {
        console.error('Error fetching order details:', err);
        this.errorMessage = 'Failed to load order details. Please try again.';
        this.cdr.detectChanges(); // Ensure error message is displayed
        return of(null); // Return null observable on error
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loadingIndicator) {
          await loadingIndicator.dismiss().catch(e => console.warn("Error dismissing loading indicator:", e));
        }
        if (refresherEvent) {
          refresherEvent.target.complete();
        }
        this.cdr.detectChanges(); // Ensure loading state updates view
      })
    );
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
      console.warn('Invalid date input for formatDate:', dateInput);
      return 'Invalid Date';
    }
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  canCancel(order: Order | undefined | null): boolean {
    if (!order) return false;
    if (['cancelled', 'delivered', 'completed'].includes(order.status)) { // Assuming 'completed' is a final status
      return false;
    }
    if (!order.cancellationDeadline) {
      console.warn('Cancellation deadline is not set for order:', order.id);
      return false;
    }
    const now = new Date();
    let deadline: Date;
    const deadlineInput = order.cancellationDeadline as any;
    if (deadlineInput && typeof deadlineInput.seconds === 'number') {
      deadline = new Date(deadlineInput.seconds * 1000);
    } else if (deadlineInput instanceof Date) {
      deadline = deadlineInput;
    } else {
      deadline = new Date(deadlineInput);
    }
    if (isNaN(deadline.getTime())) {
      console.warn('Invalid cancellation deadline format for order:', order.id, deadlineInput);
      return false;
    }
    return now <= deadline;
  }

  async cancelOrder(order: Order | undefined | null) { // Renamed to avoid conflict if template uses 'cancelOrder'
    if (!order || !order.id) {
      this.showToast('Cannot cancel order: Order details missing.', 'danger');
      return;
    }

    if (!this.canCancel(order)) {
      this.showToast('This order can no longer be cancelled.', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirm Cancellation',
      message: 'Are you sure you want to cancel this order? Please provide a reason (optional).',
      inputs: [{ name: 'reason', type: 'textarea', placeholder: 'Reason for cancellation' }],
      buttons: [
        { text: 'Back', role: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          cssClass: 'alert-button-danger',
          handler: async (data) => {
            const reason = data.reason?.trim() || 'Customer cancelled without providing a reason';
            this.isCancelling = true;
            const loading = await this.loadingController.create({
              message: 'Cancelling order...',
              spinner: 'crescent'
            });
            await loading.present();
            try {
              await firstValueFrom(this.customerOrderService.cancelOrder(order.id!, reason));
              this.showToast('Order cancelled successfully.', 'success');
              this.loadOrderDetails(); // Refresh order details
            } catch (error: any) {
              console.error('Error cancelling order:', error);
              this.showErrorAlert('Cancellation Failed', error?.message || 'An unexpected error occurred.');
            } finally {
              this.isCancelling = false;
              await loading.dismiss().catch(e => console.warn("Error dismissing cancel loading:", e));
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async showErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({
      message: message,
      duration: duration,
      color: color,
      position: 'top'
    });
    await toast.present();
  }

  doRefresh(event: any) {
    this.loadOrderDetails(event);
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    // No need to unsubscribe from orderDataSubscription if it was never assigned
    // because orderData$ is consumed by async pipe.
  }
}
