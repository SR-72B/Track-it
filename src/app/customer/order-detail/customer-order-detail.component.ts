// src/app/customer/order-detail/customer-order-detail.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core'; // Added OnDestroy
import { ActivatedRoute, Router, RouterModule } from '@angular/router'; // Added RouterModule
import { CommonModule } from '@angular/common'; // Added CommonModule
import { AlertController, LoadingController, ToastController, IonicModule } from '@ionic/angular'; // Added IonicModule
import { Observable, Subscription, firstValueFrom, of } from 'rxjs'; // Added Subscription, of
import { finalize, catchError } from 'rxjs/operators'; // Added catchError

import { Order, OrderUpdate } from '../../retailer/order-management/order.service'; // Ensure this path is correct
import { CustomerOrderService } from '../order/customer-order.service'; // Ensure this path is correct

@Component({
  selector: 'app-customer-order-detail',
  templateUrl: './customer-order-detail.component.html', // Ensure this file exists
  styleUrls: ['./customer-order-detail.component.scss'],   // Ensure this file exists
  standalone: true, // Mark component as standalone
  imports: [
    CommonModule,     // For *ngIf, *ngFor, async pipe, etc.
    IonicModule,      // For Ionic components (ion-card, ion-list, ion-button, ion-spinner etc.) and services
    RouterModule      // For routerLink (if used in the template)
  ]
})
export class CustomerOrderDetailComponent implements OnInit, OnDestroy {
  orderId: string | null = null; // Initialize to null
  orderData$: Observable<{order: Order, updates: OrderUpdate[]} | null > = of(null); // Initialize with null observable
  isLoading = true;
  isCancelling = false;
  errorMessage: string | null = null;

  private routeSubscription: Subscription | undefined;
  private orderDataSubscription: Subscription | undefined;


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerOrderService: CustomerOrderService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.orderId = id;
        this.loadOrder();
      } else {
        console.error('Order ID not found in route parameters');
        this.errorMessage = 'Order ID is missing. Cannot display order details.';
        this.isLoading = false;
        // Optionally navigate back or show a more prominent error
        this.router.navigate(['/customer/orders']);
      }
    });
  }

  async loadOrder(refresherEvent?: any) {
    if (!this.orderId) {
      this.isLoading = false;
      this.errorMessage = 'Cannot load order: Order ID is missing.';
      if (refresherEvent) refresherEvent.target.complete();
      console.error(this.errorMessage);
      // No need for toast here as ngOnInit error handling or template will show message
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    let loadingIndicator: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) { // Only show full page loader if not a refresher action
      loadingIndicator = await this.loadingController.create({
        message: 'Loading order details...',
        spinner: 'crescent',
        backdropDismiss: false
      });
      await loadingIndicator.present();
    }

    // Unsubscribe from previous order data subscription if it exists
    if (this.orderDataSubscription) {
        this.orderDataSubscription.unsubscribe();
    }

    this.orderDataSubscription = this.customerOrderService.getOrderWithUpdates(this.orderId).pipe(
      catchError(err => {
        console.error('Error fetching order details:', err);
        this.errorMessage = 'Failed to load order details. Please try again.';
        this.orderData$ = of(null); // Set to null observable on error
        return of(null); // Propagate null or an empty structure
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loadingIndicator) {
          await loadingIndicator.dismiss().catch(e => console.warn("Error dismissing loading indicator:", e));
        }
        if (refresherEvent) {
          refresherEvent.target.complete();
        }
        // Mark updates as seen after data is loaded (or attempted to load)
        if (this.orderId && !this.errorMessage) { // Only if orderId exists and no major error occurred
          try {
            await firstValueFrom(this.customerOrderService.markUpdatesSeen(this.orderId));
          } catch (error) {
            console.warn('Failed to mark updates as seen:', error);
            // This is a background task, so typically no need to show a user-facing error unless critical
          }
        }
      })
    ).subscribe(data => {
        if(data){
            this.orderData$ = of(data); // Update the observable for the async pipe
        } else if (!this.errorMessage) {
            // If data is null from catchError and no specific error message was set yet
            this.errorMessage = 'Order details could not be loaded.';
        }
    });
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
      console.warn('Invalid date input for formatDate:', dateInput);
      return 'Invalid Date';
    }
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  canCancel(order: Order | undefined | null): boolean {
    if (!order) return false;
    if (['cancelled', 'delivered', 'completed'].includes(order.status)) {
      return false;
    }
    if (!order.cancellationDeadline) {
      console.warn('Cancellation deadline is not set for order:', order.id);
      return false; // Or true, depending on business logic if deadline is missing
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

  async cancelOrder(order: Order | undefined | null) {
    if (!order || !order.id) {
      console.error('Order or Order ID is undefined, cannot cancel.');
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
              await this.loadOrder(); // Refresh order details
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
    this.loadOrder(event);
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    if (this.orderDataSubscription) {
        this.orderDataSubscription.unsubscribe();
    }
  }
}