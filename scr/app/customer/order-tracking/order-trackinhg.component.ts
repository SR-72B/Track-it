// src/app/customer/order-tracking/order-tracking.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { CustomerOrderService } from '../order/customer-order.service';
import { Order, OrderUpdate } from '../../retailer/order-management/order.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-order-tracking',
  templateUrl: './order-tracking.component.html',
  styleUrls: ['./order-tracking.component.scss']
})
export class OrderTrackingComponent implements OnInit {
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
  ];
  
  currentStepIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private customerOrderService: CustomerOrderService,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.orderId = params['id'];
      this.loadOrderDetails();
    });
  }

  async loadOrderDetails() {
    const loading = await this.loadingController.create({
      message: 'Loading order details...',
      spinner: 'crescent'
    });
    await loading.present();

    this.order$ = this.customerOrderService.getOrder(this.orderId);
    this.updates$ = this.customerOrderService.getOrderUpdates(this.orderId).pipe(
      map(updates => updates.sort((a, b) => {
        // Sort by timestamp (descending)
        const dateA = new Date(a.createdAt.seconds ? a.createdAt.seconds * 1000 : a.createdAt);
        const dateB = new Date(b.createdAt.seconds ? b.createdAt.seconds * 1000 : b.createdAt);
        return dateB.getTime() - dateA.getTime();
      }))
    );

    // Subscribe to get the current step index
    this.order$.subscribe(order => {
      // Find the index of the current status in the steps
      this.currentStepIndex = this.statusSteps.findIndex(step => step.status === order.status);
      
      // If order is cancelled, set to -1 to show special state
      if (order.status === 'cancelled') {
        this.currentStepIndex = -1;
      }
      
      loading.dismiss();
      this.isLoading = false;
      
      // Mark updates as seen
      this.customerOrderService.markUpdatesSeen(this.orderId).subscribe();
    });
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  // Get progress percentage for the status bar
  getProgressPercentage(): number {
    if (this.currentStepIndex === -1) {
      return 0; // Cancelled order
    }
    
    const totalSteps = this.statusSteps.length - 1; // -1 because we're calculating segments
    const progress = this.currentStepIndex / totalSteps * 100;
    return progress;
  }
}