// src/app/retailer/order-detail/order-detail.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController, ToastController, IonicModule } from '@ionic/angular';
import { Observable, Subscription, of, firstValueFrom } from 'rxjs';
import { catchError, finalize, tap, filter } from 'rxjs/operators'; // Ensure filter is imported
import { OrderService, Order, OrderUpdate } from '../order-management/order.service';

@Component({
  selector: 'app-order-detail',
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule
  ]
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  orderId: string | null = null;
  orderData$: Observable<{order: Order, updates: OrderUpdate[]} | null> = of(null);
  updateForm: FormGroup;
  isSubmittingUpdate = false; // Correct property name
  isCancellingOrder = false; // This is the correct property name used in the component
  isLoading = true;
  errorMessage: string | null = null;

  statuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  private routeSubscription: Subscription | undefined;
  // orderDataSubscription is not strictly needed if primarily using async pipe and firstValueFrom for actions

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private fb: FormBuilder,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef
  ) {
    this.updateForm = this.fb.group({
      status: ['', Validators.required],
      message: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.orderId = id;
        this.loadOrderDetails();
      } else {
        this.isLoading = false;
        this.errorMessage = 'Order ID not found in route parameters.';
        console.error(this.errorMessage);
        this.router.navigate(['/retailer/orders']);
      }
    });
  }

  async loadOrderDetails(refresherEvent?: any) {
    if (!this.orderId) {
      this.isLoading = false;
      this.errorMessage = 'Cannot load order: Order ID is missing.';
      if (refresherEvent) refresherEvent.target.complete();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
        loader = await this.loadingController.create({ message: 'Loading order details...' });
        await loader.present();
    }

    this.orderData$ = this.orderService.getOrderWithUpdates(this.orderId).pipe(
      tap(data => {
        if (data && data.order) {
          // Pre-fill logic if needed
        } else if (!data && !this.errorMessage) {
            this.errorMessage = 'Order not found.';
        }
        this.cdr.detectChanges();
      }),
      catchError(err => {
        console.error('Error loading order details:', err);
        this.errorMessage = 'Failed to load order details. Please try again.';
        return of(null);
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loader) await loader.dismiss().catch(e => console.warn("Loader dismiss error", e));
        if (refresherEvent) refresherEvent.target.complete();
        this.cdr.detectChanges();
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
      return 'Invalid Date';
    }
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  public getStatusColor(status: string | undefined): string {
    if (!status) return 'medium';
    switch (status.toLowerCase()) {
      case 'pending': return 'warning';
      case 'processing': return 'primary';
      case 'shipped': return 'tertiary';
      case 'delivered': return 'success';
      case 'cancelled': return 'danger';
      default: return 'medium';
    }
  }

  // Add the missing canCancel method
  public canCancel(order: Order | undefined | null): boolean {
    if (!order) return false;
    if (['cancelled', 'delivered', 'completed'].includes(order.status)) {
      return false;
    }
    // Assuming a similar logic to CustomerOrderDetailComponent or your business rules
    // For example, if there's a cancellationPolicy.cancellationWindowHours on the form used for the order
    // This is a placeholder, adapt it to your actual cancellation logic for retailers
    // For now, let's assume retailers can cancel 'pending' or 'processing' orders.
    if (order.status === 'pending' || order.status === 'processing') {
        // Add more specific logic if available, e.g., based on time elapsed or form's policy
        return true;
    }
    // If no specific retailer cancellation logic is defined yet,
    // you might want to return false or a more lenient true based on requirements.
    // For demonstration, allowing cancellation if not shipped, delivered, or cancelled.
    // return !['shipped', 'delivered', 'cancelled', 'completed'].includes(order.status);

    // Defaulting to a simple check for now, adjust as per your business logic
    return order.status === 'pending';
  }

  async updateOrder() {
    if (this.updateForm.invalid) {
      this.markFormGroupTouched(this.updateForm);
      this.showToast('Please select a status and provide an update message.', 'warning');
      return;
    }
    if (!this.orderId) {
        this.showToast('Order ID is missing. Cannot update.', 'danger');
        return;
    }

    this.isSubmittingUpdate = true;
    const loading = await this.loadingController.create({
      message: 'Updating order status...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const { status, message } = this.updateForm.value;
      
      const orderData = await firstValueFrom(
        this.orderData$.pipe(
          filter((data): data is { order: Order; updates: OrderUpdate[] } => !!data && !!data.order)
        )
      );

      await this.orderService.updateOrderStatus(orderData.order, status, message);
      
      this.updateForm.reset();
      this.showToast('Order updated successfully!', 'success');
      this.loadOrderDetails();

    } catch (error: any) {
      console.error('Error updating order:', error);
      this.showErrorAlert('Update Failed', error.message || 'Current order details not available or an error occurred.');
    } finally {
      this.isSubmittingUpdate = false;
      await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
    }
  }

  async confirmCancelOrder() { // Correct method name
    let currentOrder: Order | undefined;
    try {
        const orderData = await firstValueFrom(
            this.orderData$.pipe(
                filter((data): data is { order: Order; updates: OrderUpdate[] } => !!data && !!data.order)
            )
        );
        currentOrder = orderData.order;
    } catch (error) {
        console.error("Error fetching current order for cancellation:", error);
        this.showToast('Order details not loaded. Cannot cancel.', 'warning');
        return;
    }

    if (!currentOrder) { // This check is somewhat redundant due to the try/catch with firstValueFrom, but safe.
      this.showToast('Order details not loaded. Cannot cancel.', 'warning');
      return;
    }

    if (currentOrder.status === 'cancelled' || currentOrder.status === 'delivered') {
        this.showToast(`Order is already ${currentOrder.status} and cannot be cancelled.`, 'medium');
        return;
    }

    const alert = await this.alertController.create({
      header: 'Cancel Order',
      message: 'Please provide a reason for cancellation:',
      inputs: [
        { name: 'reason', type: 'textarea', placeholder: 'Reason for cancellation (required)' }
      ],
      buttons: [
        { text: 'Back', role: 'cancel' },
        {
          text: 'Confirm Cancellation',
          cssClass: 'alert-button-danger',
          handler: async (data) => {
            if (!data.reason || data.reason.trim() === '') {
              this.showToast('A cancellation reason is required.', 'warning');
              return false;
            }
            
            this.isCancellingOrder = true;
            const loading = await this.loadingController.create({ message: 'Cancelling order...' });
            await loading.present();

            try {
              await this.orderService.cancelOrder(currentOrder!, data.reason.trim()); // currentOrder is defined here
              this.showToast('Order cancelled successfully.', 'success');
              this.loadOrderDetails();
            } catch (error: any) {
              console.error('Error cancelling order:', error);
              this.showErrorAlert('Cancellation Failed', error.message || 'There was an error cancelling the order.');
            } finally {
              this.isCancellingOrder = false;
              await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
            }
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({ message, duration, color, position: 'top' });
    toast.present();
  }

  async showErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  doRefresh(event: any) {
    this.loadOrderDetails(event);
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    // orderDataSubscription was removed as orderData$ is handled by async pipe or firstValueFrom
  }
}
