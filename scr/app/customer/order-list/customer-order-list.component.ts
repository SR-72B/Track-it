// src/app/customer/order-list/customer-order-list.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { AuthService } from '../../auth/auth.service';
import { CustomerOrderService } from '../order/customer-order.service';
import { Order } from '../../retailer/order-management/order.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-customer-order-list',
  templateUrl: './customer-order-list.component.html',
  styleUrls: ['./customer-order-list.component.scss']
})
export class CustomerOrderListComponent implements OnInit {
  orders$: Observable<Order[]>;
  isLoading = true;
  segment = 'all';

  constructor(
    private authService: AuthService,
    private customerOrderService: CustomerOrderService,
    private router: Router,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.loadOrders();
  }

  async loadOrders() {
    const loading = await this.loadingController.create({
      message: 'Loading orders...',
      spinner: 'crescent'
    });
    await loading.present();

    this.authService.currentUser$.pipe(first()).subscribe(user => {
      if (user) {
        this.orders$ = this.customerOrderService.getCustomerOrders(user.uid).pipe(
          map(orders => {
            // Filter orders based on the selected segment
            if (this.segment !== 'all') {
              return orders.filter(order => order.status === this.segment);
            }
            return orders;
          })
        );
        
        this.isLoading = false;
        loading.dismiss();
      } else {
        this.isLoading = false;
        loading.dismiss();
      }
    });
  }

  segmentChanged(event: any) {
    this.segment = event.detail.value;
    this.loadOrders();
  }

  viewOrderDetails(orderId: string) {
    this.router.navigate(['/customer/orders', orderId]);
  }

  trackOrder(orderId: string) {
    this.router.navigate(['/customer/tracking', orderId]);
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'processing':
        return 'primary';
      case 'shipped':
        return 'tertiary';
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'danger';
      default:
        return 'medium';
    }
  }
}