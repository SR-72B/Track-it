

// src/app/retailer/order-detail/order-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import { OrderService, Order, OrderUpdate } from '../order-management/order.service';

@Component({
  selector: 'app-order-detail',
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.scss']
})
export class OrderDetailComponent implements OnInit {
  orderId: string;
  order$: Observable<{order: Order, updates: OrderUpdate[]}>;
  updateForm: FormGroup;
  isSubmitting = false;
  statuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private fb: FormBuilder,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    this.updateForm = this.fb.group({
      status: ['', Validators.required],
      message: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.orderId = params['id'];
      this.loadOrder();
    });
  }

  loadOrder() {
    this.order$ = this.orderService.getOrderWithUpdates(this.orderId);
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  async updateOrder() {
    if (this.updateForm.valid) {
      this.isSubmitting = true;
      const loading = await this.loadingController.create({
        message: 'Updating order...',
        spinner: 'crescent'
      });
      await loading.present();

      try {
        const { status, message } = this.updateForm.value;
        
        // Get the current order
        const orderData = await this.order$.pipe(first()).toPromise();
        const order = orderData.order;
        
        await this.orderService.updateOrderStatus(order, status, message);
        
        await loading.dismiss();
        this.isSubmitting = false;

        // Reset form
        this.updateForm.reset();
        
        const toast = await this.toastController.create({
          message: 'Order updated successfully',
          duration: 2000,
          color: 'success'
        });
        toast.present();
        
        // Reload order to show the update
        this.loadOrder();
      } catch (error) {
        await loading.dismiss();
        this.isSubmitting = false;
        
        const alert = await this.alertController.create({
          header: 'Error',
          message: error.message || 'There was an error updating the order.',
          buttons: ['OK']
        });
        await alert.present();
      }
    }
  }

  async cancelOrder() {
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
          text: 'Cancel',
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
            
            const loading = await this.loadingController.create({
              message: 'Cancelling order...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              // Get the current order
              const orderData = await this.order$.pipe(first()).toPromise();
              const order = orderData.order;
              
              await this.orderService.cancelOrder(order, data.reason);
              
              await loading.dismiss();
              
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