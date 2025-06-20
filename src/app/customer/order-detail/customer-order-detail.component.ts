// src/app/customer/order-detail/customer-order-detail.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController, ToastController, IonicModule } from '@ionic/angular';
import { Observable, Subscription, firstValueFrom, of } from 'rxjs';
import { finalize, catchError, tap } from 'rxjs/operators';

import { Order, OrderUpdate } from '../../retailer/order-management/order.service';
import { CustomerOrderService } from '../order/customer-order.service';

// Add these interfaces to fix the titlecase pipe error
interface FieldData {
  key: string;
  value: string | number | boolean | null;
  label?: string;
  type?: string;
}

interface OrderWithTypedFields extends Order {
  fields?: FieldData[];
  customFields?: FieldData[];
  metadata?: FieldData[];
}

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
  orderData$: Observable<{order: OrderWithTypedFields, updates: OrderUpdate[]} | null > = of(null);
  isLoading = true;
  isCancelling = false;
  errorMessage: string | null = null;

  private routeSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerOrderService: CustomerOrderService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.orderId = id;
        this.loadOrderDetails();
      } else {
        this.isLoading = false;
        this.errorMessage = 'Order ID is missing.';
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

    this.orderData$ = this.customerOrderService.getOrderWithUpdates(this.orderId).pipe(
      tap(data => {
        if (!data?.order) {
          this.errorMessage = 'Order not found or could not be loaded.';
        } else if (this.orderId) {
          firstValueFrom(this.customerOrderService.markUpdatesSeen(this.orderId))
            .catch(error => console.warn('Failed to mark updates as seen:', error));
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }),
      catchError(err => {
        this.isLoading = false;
        console.error('Error fetching order details:', err);
        this.errorMessage = 'Failed to load order details. Please try again.';
        this.cdr.detectChanges();
        return of(null);
      }),
      finalize(() => {
        if (refresherEvent) {
          refresherEvent.target.complete();
        }
      })
    );
  }

  // Add this helper method to safely get fields with proper typing
  public getOrderFields(order: Order | undefined | null): FieldData[] {
    if (!order) return [];
    
    // Check different possible field properties and ensure they're properly typed
    const fields = (order as any).fields || (order as any).customFields || (order as any).metadata || [];
    
    // Ensure each field has a string key
    return fields.map((field: any) => ({
      key: String(field.key || ''),
      value: field.value,
      label: field.label,
      type: field.type
    }));
  }

  public getStatusColor(status: string | undefined): string {
    if (!status) return 'medium';
    const lowerStatus = status.toLowerCase();
    switch (lowerStatus) {
      case 'active':
      case 'trialing':
      case 'delivered':
      case 'completed':
        return 'success';
      case 'past_due':
      case 'incomplete':
      case 'pending':
        return 'warning';
      case 'cancelled':
      case 'unpaid':
      case 'incomplete_expired':
      case 'ended':
      case 'failed':
        return 'danger';
      case 'processing':
        return 'primary';
      case 'shipped':
        return 'tertiary';
      default:
        return 'medium';
    }
  }

  public formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';
    let d: Date;
    if (dateInput && typeof dateInput.seconds === 'number') {
      d = new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1000000);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  public canCancel(order: Order | undefined | null): boolean {
    if (!order) return false;
    if (['cancelled', 'delivered', 'completed', 'shipped'].includes(order.status)) {
      return false;
    }
    if (!order.cancellationDeadline) {
      return false;
    }
    const now = new Date();
    let deadline: Date;
    const deadlineInput = order.cancellationDeadline as any;
    if (deadlineInput && typeof deadlineInput.seconds === 'number') {
      deadline = new Date(deadlineInput.seconds * 1000);
    } else {
      deadline = new Date(deadlineInput);
    }
    return !isNaN(deadline.getTime()) && now <= deadline;
  }

  public async cancelOrder(order: Order | undefined | null) {
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
            this.cdr.detectChanges();
            const loading = await this.loadingController.create({ message: 'Cancelling order...' });
            await loading.present();
            try {
              await firstValueFrom(this.customerOrderService.cancelOrder(order.id!, reason));
              this.showToast('Order cancelled successfully.', 'success');
              this.loadOrderDetails();
            } catch (error: any) {
              this.showErrorAlert('Cancellation Failed', error?.message || 'An unexpected error occurred.');
            } finally {
              this.isCancelling = false;
              await loading.dismiss().catch(e => console.warn("Error dismissing cancel loading:", e));
              this.cdr.detectChanges();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  public doRefresh(event: any) {
    this.loadOrderDetails(event);
  }

  private async showToast(message: string, color: string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({ message, duration, color, position: 'top' });
    toast.present();
  }

  private async showErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }
}
