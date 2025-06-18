
// src/app/retailer/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService, User } from '../../auth/auth.service';
import { OrderService, Order } from '../order-management/order.service';
import { FormBuilderService, OrderForm } from '../form-builder/form-builder.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  user$: Observable<User | null>;
  recentOrders$: Observable<Order[]>;
  activeForms$: Observable<OrderForm[]>;
  orderCounts: {[key: string]: number} = {
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  };
  isLoading = true;

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private formBuilderService: FormBuilderService,
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
        this.recentOrders$ = this.orderService.getRetailerOrders(user.uid).pipe(
          map(orders => {
            // Calculate order counts
            this.orderCounts.total = orders.length;
            this.orderCounts.pending = orders.filter(o => o.status === 'pending').length;
            this.orderCounts.processing = orders.filter(o => o.status === 'processing').length;
            this.orderCounts.shipped = orders.filter(o => o.status === 'shipped').length;
            this.orderCounts.delivered = orders.filter(o => o.status === 'delivered').length;
            this.orderCounts.cancelled = orders.filter(o => o.status === 'cancelled').length;
            
            // Get only the 5 most recent orders
            this.isLoading = false;
            return orders.slice(0, 5);
          })
        );
        
        // Get active forms
        this.activeForms$ = this.formBuilderService.getRetailerForms(user.uid).pipe(
          map(forms => {
            return forms.filter(form => form.active).slice(0, 3);
          })
        );
      } else {
        this.isLoading = false;
      }
    });
  }

  viewAllOrders() {
    this.router.navigate(['/retailer/orders']);
  }

  viewOrder(orderId: string) {
    this.router.navigate(['/retailer/orders', orderId]);
  }

  viewAllForms() {
    this.router.navigate(['/retailer/forms']);
  }

  editForm(formId: string) {
    this.router.navigate(['/retailer/forms/edit', formId]);
  }

  createForm() {
    this.router.navigate(['/retailer/forms/create']);
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString();
  }
}