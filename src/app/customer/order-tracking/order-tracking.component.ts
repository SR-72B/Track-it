// src/app/customer/order-tracking/order-tracking.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { CustomerOrderService } from '../order/customer-order.service';
import { Order, OrderUpdate } from '../../retailer/order-management/order.service';
import { Observable, Subscription, combineLatest } from 'rxjs'; // Import combineLatest and Subscription
import { map, finalize, tap } from 'rxjs/operators';

@Component({
  selector: 'app-order-tracking',
  templateUrl: './order-tracking.component.html',
  styleUrls: ['./order-tracking.component.scss']
})
export class OrderTrackingComponent implements OnInit, OnDestroy {
  orderId: string;
  order$: Observable<Order>;
  updates$: Observable<OrderUpdate[]>;
  isLoading = true;

  // Status steps for the progress bar
  statusSteps = [
    { status: 'pending', label: 'Pending' },
    { status: 'processing', label: 'Processing' },
    { status: 'shipped', label: 'Shipped' },
    { status: 'delivered', label: 'Delivered' }
    // Note: 'cancelled' is handled as a special case, not a regular step.
  ];

  currentStepIndex = 0;
  private detailsSubscription: Subscription; // To manage subscription

  constructor(
    private route: ActivatedRoute,
    private customerOrderService: CustomerOrderService,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.orderId = id;
        this.loadOrderDetails();
      } else {
        console.error('Order ID not found in route parameters for tracking.');
        this.isLoading = false;
        // Optionally navigate away or show an error message
      }
    });
  }

  async loadOrderDetails() {
    if (!this.orderId) {
      this.isLoading = false;
      console.error('Cannot load order tracking details without an Order ID.');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Loading order tracking details...',
      spinner: 'crescent',
      backdropDismiss: false
    });
    await loading.present();

    this.order$ = this.customerOrderService.getOrder(this.orderId);
    this.updates$ = this.customerOrderService.getOrderUpdates(this.orderId).pipe(
      map(updates => updates.sort((a, b) => {
        // Cast to 'any' for runtime check of .seconds, addressing TypeScript compile-time error
        const dateAInput = a.createdAt as any;
        const dateBInput = b.createdAt as any;

        // Convert to Date objects for comparison
        const dateA = new Date(dateAInput?.seconds ? dateAInput.seconds * 1000 : dateAInput);
        const dateB = new Date(dateBInput?.seconds ? dateBInput.seconds * 1000 : dateBInput);
        
        // Handle invalid dates if necessary, though getTime() on invalid date is NaN
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            // Decide how to sort if dates are invalid, e.g., push them to end or log error
            return 0; 
        }
        return dateB.getTime() - dateA.getTime(); // Sort by timestamp (descending)
      }))
    );

    // Use combineLatest to wait for both order and updates if needed,
    // or subscribe to order$ first to set currentStepIndex.
    // Here, we primarily need order$ to determine the current step.
    if (this.detailsSubscription) {
        this.detailsSubscription.unsubscribe(); // Unsubscribe from previous subscription if any
    }

    this.detailsSubscription = this.order$.pipe(
      tap(order => {
        if (order) {
          // Find the index of the current status in the steps
          this.currentStepIndex = this.statusSteps.findIndex(step => step.status === order.status);

          // If order is cancelled, set to a special index (e.g., -1)
          if (order.status === 'cancelled') {
            this.currentStepIndex = -1; // Indicates a cancelled state for the progress bar
          }
          
          // Mark updates as seen (fire-and-forget, but handle errors if critical)
          this.customerOrderService.markUpdatesSeen(this.orderId).subscribe({
            error: err => console.error('Failed to mark updates as seen:', err)
          });
        }
      }),
      finalize(async () => { // Ensure loading is dismissed
        this.isLoading = false;
        if (loading) {
          await loading.dismiss();
        }
      })
    ).subscribe({
      error: err => {
        console.error('Error loading order details for tracking:', err);
        // isLoading and loading dismissal are handled by finalize
      }
    });
  }

  /**
   * Formats a date input into a readable string (Date and Time).
   * Handles Firebase Timestamps, JavaScript Date objects, and date strings/numbers.
   * @param dateInput The date to format (can be Firebase Timestamp, Date, string, or number). Typed as 'any' for runtime checks.
   * @returns A formatted date-time string or a placeholder for invalid/missing dates.
   */
  formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';

    let d: Date;

    // Case 1: Input is a Firebase Timestamp-like object
    if (dateInput && typeof dateInput.seconds === 'number' && typeof dateInput.nanoseconds === 'number') {
      d = new Date(dateInput.seconds * 1000);
    }
    // Case 2: Input is already a JavaScript Date object
    else if (dateInput instanceof Date) {
      d = dateInput;
    }
    // Case 3: Input is a string or number that can be parsed
    else {
      d = new Date(dateInput);
    }

    // Validate the created Date object
    if (isNaN(d.getTime())) {
      console.warn('Invalid date input for formatDate in tracking:', dateInput);
      return 'Invalid Date';
    }

    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Get progress percentage for the status bar
  getProgressPercentage(): number {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.statusSteps.length) {
      // Handles 'cancelled' (index -1) or unexpected indices by showing 0 or 100 if delivered
      if (this.currentStepIndex === this.statusSteps.length -1 && this.statusSteps[this.currentStepIndex]?.status === 'delivered') return 100;
      return 0; 
    }
    
    // Calculate progress based on the current step index among defined steps
    // Example: If 4 steps (indices 0, 1, 2, 3), totalSegments = 3.
    // Step 0 -> 0%
    // Step 1 -> 1/3 * 100 = 33.3%
    // Step 2 -> 2/3 * 100 = 66.6%
    // Step 3 (Delivered) -> 3/3 * 100 = 100%
    const totalSegments = this.statusSteps.length - 1;
    if (totalSegments <= 0) return 100; // If only one step, it's 100%

    const progress = (this.currentStepIndex / totalSegments) * 100;
    return Math.min(progress, 100); // Cap at 100%
  }

  ngOnDestroy() {
    // Unsubscribe to prevent memory leaks when the component is destroyed
    if (this.detailsSubscription) {
      this.detailsSubscription.unsubscribe();
    }
  }
}
