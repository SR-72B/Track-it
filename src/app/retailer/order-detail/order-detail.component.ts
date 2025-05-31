// src/app/retailer/order-detail/order-detail.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'; // Added ChangeDetectorRef
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController, ToastController, IonicModule } from '@ionic/angular';
import { Observable, Subscription, of, firstValueFrom } from 'rxjs';
import { catchError, finalize, tap, filter } from 'rxjs/operators'; // Added filter
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
  isSubmittingUpdate = false;
  isCancellingOrder = false;
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
  private orderDataSubscription: Subscription | undefined; // To manage explicit subscriptions if any

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private fb: FormBuilder,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef // Injected ChangeDetectorRef
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

    if (this.orderDataSubscription) {
        this.orderDataSubscription.unsubscribe();
    }

    this.orderData$ = this.orderService.getOrderWithUpdates(this.orderId).pipe(
      tap(data => {
        if (data && data.order) {
           // Example: Pre-fill form if needed, but ensure this doesn't cause issues if form is already dirty
           // if (!this.updateForm.dirty) {
           //   this.updateForm.patchValue({ status: data.order.status }, { emitEvent: false });
           // }
        } else if (!data && !this.errorMessage) {
            this.errorMessage = 'Order not found.';
        }
        this.cdr.detectChanges(); // Ensure view updates with new data or error
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
        this.cdr.detectChanges(); // Ensure loading state updates view
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
      
      // Use firstValueFrom with a type guard in filter to ensure orderData and orderData.order are not null
      const orderData = await firstValueFrom(
        this.orderData$.pipe(
          filter((data): data is { order: Order; updates: OrderUpdate[] } => !!data && !!data.order)
        )
      );
      // If firstValueFrom resolves, orderData and orderData.order are guaranteed to be non-null here

      await this.orderService.updateOrderStatus(orderData.order, status, message);
      
      this.updateForm.reset();
      this.showToast('Order updated successfully!', 'success');
      this.loadOrderDetails(); // Refresh data

    } catch (error: any) { // This catch will also handle if firstValueFrom rejects (e.g., orderData$ emits only null then completes)
      console.error('Error updating order:', error);
      this.showErrorAlert('Update Failed', error.message || 'Current order details not available or an error occurred.');
    } finally {
      this.isSubmittingUpdate = false;
      await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
    }
  }

  async confirmCancelOrder() {
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

    if (!currentOrder) { // Should be caught by the try/catch if firstValueFrom rejects
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
              this.loadOrderDetails(); // Refresh data
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
    if (this.orderDataSubscription) { // If you end up using a manual subscription for orderData$
        this.orderDataSubscription.unsubscribe();
    }
  }
}
