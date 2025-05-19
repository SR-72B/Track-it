// src/app/customer/order-detail/customer-order-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Observable, firstValueFrom } from 'rxjs'; // Import firstValueFrom for modern RxJS
import { finalize } from 'rxjs/operators';
import { Order, OrderUpdate } from '../../retailer/order-management/order.service'; // Ensure this path is correct
import { CustomerOrderService } from '../order/customer-order.service'; // Ensure this path is correct

@Component({
  selector: 'app-customer-order-detail',
  templateUrl: './customer-order-detail.component.html',
  styleUrls: ['./customer-order-detail.component.scss']
})
export class CustomerOrderDetailComponent implements OnInit {
  orderId: string;
  // The Observable will emit an object containing the order and its updates
  orderData$: Observable<{order: Order, updates: OrderUpdate[]}>;
  isLoading = true;
  isCancelling = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerOrderService: CustomerOrderService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    // Subscribe to route parameters to get the order ID
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.orderId = id;
        this.loadOrder(); // Load order details when ID is available
      } else {
        console.error('Order ID not found in route parameters');
        // Optionally navigate back or show an error message to the user
        this.router.navigate(['/customer/orders']); // Example: navigate to orders list
      }
    });
  }

  async loadOrder() {
    // Ensure orderId is present before attempting to load
    if (!this.orderId) {
      this.isLoading = false;
      console.error('Cannot load order without an Order ID.');
      const toast = await this.toastController.create({
        message: 'Could not load order details: Missing ID.',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
      return;
    }

    this.isLoading = true; // Set loading state
    const loading = await this.loadingController.create({
      message: 'Loading order details...',
      spinner: 'crescent',
      backdropDismiss: false // Prevent dismissal by clicking on the backdrop
    });
    await loading.present();

    // Fetch order and its updates
    this.orderData$ = this.customerOrderService.getOrderWithUpdates(this.orderId).pipe(
      finalize(async () => { // Operations to perform after the observable completes or errors
        this.isLoading = false; // Reset loading state
        if (loading) {
            await loading.dismiss(); // Dismiss the loading indicator
        }

        // Mark updates as seen by the customer
        try {
          if (this.orderId) { // Ensure orderId is still valid
            await firstValueFrom(this.customerOrderService.markUpdatesSeen(this.orderId));
          }
        } catch (error) {
          console.error('Failed to mark updates as seen:', error);
          // Optionally inform the user if this fails, though it's a background task
        }
      })
    );
  }

  /**
   * Formats a date input into a readable string.
   * Handles Firebase Timestamps, JavaScript Date objects, and date strings/numbers.
   * @param dateInput The date to format (can be Firebase Timestamp, Date, string, or number). It's typed as 'any' to allow runtime checks.
   * @returns A formatted date string or a placeholder string for invalid/missing dates.
   */
  formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A'; // Return a placeholder for null or undefined dates

    let d: Date;

    // Case 1: Input is a Firebase Timestamp-like object (has .seconds and .nanoseconds)
    // The 'any' type for dateInput allows this access without a compile-time error here.
    if (dateInput && typeof dateInput.seconds === 'number' && typeof dateInput.nanoseconds === 'number') {
      d = new Date(dateInput.seconds * 1000); // Convert seconds to milliseconds
    }
    // Case 2: Input is already a JavaScript Date object
    else if (dateInput instanceof Date) {
      d = dateInput;
    }
    // Case 3: Input is a string or number that can be parsed by new Date()
    else {
      d = new Date(dateInput);
    }

    // Validate if the created Date object is valid
    if (isNaN(d.getTime())) {
      console.warn('Invalid date input for formatDate:', dateInput);
      return 'Invalid Date'; // Return a placeholder for invalid dates
    }

    // Format the valid date
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Determines if an order can be cancelled based on its status and cancellation deadline.
   * @param order The order object to check.
   * @returns True if the order can be cancelled, false otherwise.
   */
  canCancel(order: Order | undefined | null): boolean {
    if (!order) return false; // Guard against null or undefined order object

    // Orders with these statuses cannot be cancelled
    if (['cancelled', 'delivered', 'completed'].includes(order.status)) {
      return false;
    }

    // Check for a valid cancellation deadline
    if (!order.cancellationDeadline) {
        console.warn('Cancellation deadline is not set for order:', order.id);
        // Business decision: if no deadline, can it be cancelled? Assuming no for safety.
        return false;
    }

    const now = new Date();
    let deadline: Date;
    // Cast order.cancellationDeadline to 'any' to satisfy the TypeScript compiler
    // when accessing .seconds and .nanoseconds. The runtime checks will handle the actual type.
    // This is necessary if the Order interface types cancellationDeadline strictly as Date,
    // but the actual data might be a Firebase Timestamp.
    const deadlineInput = order.cancellationDeadline as any;

    // Convert deadlineInput to a Date object, similar to formatDate
    if (deadlineInput && typeof deadlineInput.seconds === 'number' && typeof deadlineInput.nanoseconds === 'number') {
      deadline = new Date(deadlineInput.seconds * 1000);
    } else if (deadlineInput instanceof Date) {
      deadline = deadlineInput;
    } else {
      deadline = new Date(deadlineInput);
    }

    // Validate the deadline date
    if (isNaN(deadline.getTime())) {
      console.warn('Invalid cancellation deadline format for order:', order.id, deadlineInput);
      return false; // Cannot determine cancellability if deadline is invalid
    }
    
    return now <= deadline; // Order can be cancelled if current time is before or at the deadline
  }

  /**
   * Initiates the order cancellation process.
   * Prompts the user for a reason and then calls the service to cancel the order.
   * @param order The order to be cancelled.
   */
  async cancelOrder(order: Order | undefined | null) {
    if (!order || !order.id) {
        console.error('Order or Order ID is undefined, cannot cancel.');
        const toast = await this.toastController.create({
            message: 'Cannot cancel order: Order details missing.',
            duration: 3000,
            color: 'danger',
            position: 'top'
        });
        await toast.present();
        return;
    }

    // Check if the order is eligible for cancellation
    if (!this.canCancel(order)) {
        const toast = await this.toastController.create({
            message: 'This order can no longer be cancelled.',
            duration: 3000,
            color: 'warning',
            position: 'top'
        });
        await toast.present();
        return;
    }

    // Confirm cancellation with the user
    const alert = await this.alertController.create({
      header: 'Confirm Cancellation',
      message: 'Are you sure you want to cancel this order? Please provide a reason (optional).',
      inputs: [
        {
          name: 'reason',
          type: 'textarea', // Using textarea for potentially longer reasons
          placeholder: 'Reason for cancellation (e.g., changed mind)'
        }
      ],
      buttons: [
        {
          text: 'Back',
          role: 'cancel',
          cssClass: 'alert-button-cancel' // Optional: for styling
        },
        {
          text: 'Yes, Cancel Order',
          cssClass: 'alert-button-danger', // Optional: for styling the confirm button
          handler: async (data) => {
            // Use provided reason or a default if none is given
            const reason = data.reason ? data.reason.trim() : 'Customer cancelled without providing a reason';

            this.isCancelling = true; // Set cancelling state
            const loading = await this.loadingController.create({
              message: 'Cancelling order...',
              spinner: 'crescent',
              backdropDismiss: false
            });
            await loading.present();

            try {
              // Call the service to cancel the order
              await firstValueFrom(this.customerOrderService.cancelOrder(order.id, reason));
              
              const toast = await this.toastController.create({
                message: 'Order cancelled successfully.',
                duration: 2500,
                color: 'success',
                position: 'top'
              });
              await toast.present();
              
              // Reload order details to reflect the cancellation.
              // The loadOrder method's finalize block will handle its own loading indicator.
              await this.loadOrder(); 
            } catch (error: any) { // Catch any errors during cancellation
              if(loading) await loading.dismiss(); // Ensure loading indicator is dismissed on error
              this.isCancelling = false; // Reset cancelling state
              
              console.error('Error cancelling order:', error);
              const errorAlert = await this.alertController.create({
                header: 'Cancellation Failed',
                message: error?.message || 'An unexpected error occurred while cancelling the order. Please try again.',
                buttons: ['OK']
              });
              await errorAlert.present();
            } finally {
              // This block executes regardless of success or failure of the try block
              // Ensures isCancelling is reset if not already done (e.g. if loadOrder itself throws an error)
              this.isCancelling = false; 
              // Defensive dismissal of loading, though usually handled in try/catch.
              // Check if loading exists and hasn't been dismissed.
              // Note: Be cautious with dismissing loading controllers that might have already been dismissed
              // or are managed by other parts of the code (like the finalize block in loadOrder).
              // The `if(loading) await loading.dismiss();` in the catch block is usually sufficient for errors.
            }
          }
        }
      ]
    });
    await alert.present();
  }
}