// src/app/customer/dashboard/customer-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService, User } from '../../auth/auth.service';
import { Order } from '../../retailer/order-management/order.service';
import { OrderForm } from '../../retailer/form-builder/form-builder.service';
import { CustomerOrderService } from '../order/customer-order.service';

@Component({
  selector: 'app-customer-dashboard',
  templateUrl: './customer-dashboard.component.html',
  styleUrls: ['./customer-dashboard.component.scss']
})
export class CustomerDashboardComponent implements OnInit {
  user$: Observable<User | null>;
  recentOrders$: Observable<Order[]>;
  availableForms$: Observable<OrderForm[]>;
  isLoading = true;

  constructor(
    private authService: AuthService,
    private customerOrderService: CustomerOrderService,
    private router: Router
  ) { }

  ngOnInit() {
    this.user$ = this.authService.currentUser$;
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.isLoading = true;
    
    this.authService.currentUser$.pipe(
      first()
    ).subscribe(user => {
      if (user) {
        // Get recent orders
        this.recentOrders$ = this.customerOrderService.getCustomerOrders(user.uid).pipe(
          map(orders => {
            // Get only the 5 most recent orders
            this.isLoading = false;
            return orders.slice(0, 5);
          })
        );
        
        // Get available forms
        this.availableForms$ = this.customerOrderService.getActiveForms().pipe(
          map(forms => {
            return forms.slice(0, 3);
          })
        );
      } else {
        this.isLoading = false;
      }
    });
  }

  viewAllOrders() {
    this.router.navigate(['/customer/orders']);
  }

  viewOrder(orderId: string) {
    this.router.navigate(['/customer/orders', orderId]);
  }

  viewAllForms() {
    this.router.navigate(['/customer/forms']);
  }

  placeOrder(formId: string) {
    this.router.navigate(['/customer/place-order', formId]);
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString();
  }
}