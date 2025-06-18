// src/app/customer/order-detail/customer-order-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { first, finalize } from 'rxjs/operators';
import { Order, OrderUpdate } from '../../retailer/order-management/order.service';
import { CustomerOrderService } from '../order/customer-order.service';

@Component({
  selector: 'app-customer-order-detail',
  templateUrl: './customer-order-detail.component.html',
  styleUrls: ['./customer-order-detail.component.scss']
})
export class CustomerOrderDetailComponent implements OnInit {
  orderId: string;
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
    this.route.params.subscribe(params => {
      this.orderId = params['id'];
      this.loadOrder();
    });
  }

  async loadOrder() {
    const loading = await this.loadingController.create({
      message: 'Loading order details...',
      spinner: 'crescent'
    });
    await loading.present();

    this.orderData$ = this.customerOrderService.getOrderWithUpdates(this.orderId).pipe(
      finalize(() => {
        this.isLoading = false;
        loading.dismiss();
        
        // Mark updates as seen by customer
        this.customerOrderService.markUpdatesSeen(this.orderId).subscribe();
      })
    );
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  canCancel(order: Order): boolean {
    if (order.status === 'cancelled' || order.status === 'delivered') {
      return false;
    }
    
    const now = new Date();
    const deadline = new Date(order.cancellationDeadline.seconds ? 
      order.cancellationDeadline.seconds * 1000 : 
      order.cancellationDeadline);
    
    return now <= deadline;
  }

  async cancelOrder(order: Order) {
    const alert = await this.alertController.create({
      header: 'Cancel Order',
      message: 'Please provide a reason for cancellation:',
      inputs: [
        {
          name: 'reason',
          type: 'text',
          placeholder: 'Cancellation reason'
        }
      ],
      buttons: [
        {
          text: 'Back',
          role: 'cancel'
        },
        {
          text: 'Confirm',
          handler: async (data) => {
            if (!data.reason) {
              const toast = await this.toastController.create({
                message: 'Please provide a cancellation reason',
                duration: 2000,
                color: 'danger'
              });
              toast.present();
              return false;
            }
            
            this.isCancelling = true;
            const loading = await this.loadingController.create({
              message: 'Cancelling order...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              await this.customerOrderService.cancelOrder(order.id, data.reason).toPromise();
              
              await loading.dismiss();
              this.isCancelling = false;
              
              const toast = await this.toastController.create({
                message: 'Order cancelled successfully',
                duration: 2000,
                color: 'success'
              });
              toast.present();
              
              // Reload order
              this.loadOrder();
            } catch (error) {
              await loading.dismiss();
              this.isCancelling = false;
              
              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: error.message || 'There was an error cancelling the order.',
                buttons: ['OK']
              });
              await errorAlert.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }
}