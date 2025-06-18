// src/app/retailer/order-list/order-list.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { OrderService, Order } from '../order-management/order.service';

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.scss']
})
export class OrderListComponent implements OnInit {
  orders$: Observable<Order[]>;
  isLoading = true;
  segment = 'all';

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.isLoading = true;
    this.authService.currentUser$.pipe(
      first()
    ).subscribe(user => {
      if (user) {
        this.orders$ = this.orderService.getRetailerOrders(user.uid).pipe(
          map(orders => {
            this.isLoading = false;
            
            // Filter orders based on the selected segment
            if (this.segment !== 'all') {
              return orders.filter(order => order.status === this.segment);
            }
            return orders;
          })
        );
      } else {
        this.isLoading = false;
      }
    });
  }

  segmentChanged(event: any) {
    this.segment = event.detail.value;
    this.loadOrders();
  }

  viewOrder(orderId: string) {
    this.router.navigate(['/retailer/orders', orderId]);
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString();
  }
}
