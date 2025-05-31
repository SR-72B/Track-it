// src/app/retailer/analytics/analytics.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { IonicModule, LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Observable, Subscription, of, forkJoin } from 'rxjs'; // forkJoin is imported but not used in this snippet, remove if not needed elsewhere
import { map, first, filter, catchError, finalize, switchMap, tap } from 'rxjs/operators'; // Added switchMap and tap

import { AuthService, User } from '../../auth/auth.service';
import { OrderService, Order } from '../order-management/order.service';

// Interface for aggregated analytics data
export interface RetailerAnalyticsData {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: { status: string; count: number; percentage: number }[];
  // Potentially: topSellingItems, salesOverTime (for charts)
}

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe
  ]
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  analyticsData: RetailerAnalyticsData | null = null;
  allOrders: Order[] = []; // Initialize as an empty array

  isLoading = true;
  errorMessage: string | null = null;

  private dataSubscription: Subscription | undefined;

  // Chart placeholders
  // ... (chart properties remain the same)

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private router: Router, // Injected but not used in this snippet, remove if not needed
    private loadingController: LoadingController,
    private alertController: AlertController, // Injected but not used in this snippet, remove if not needed
    private toastController: ToastController, // Injected but not used in this snippet, remove if not needed
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadInitialData();
  }

  async loadInitialData(refresherEvent?: any) {
    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
      loader = await this.loadingController.create({ message: 'Loading analytics...' });
      await loader.present();
    }

    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }

    this.dataSubscription = this.authService.currentUser$.pipe(
      first((user): user is User => !!user && !!user.uid), // Ensure user is User and has uid
      switchMap(user => { // switchMap is now imported
        // No need for '!user' check here due to the filter in first()
        this.currentUser = user;
        return this.orderService.getRetailerOrders(user.uid).pipe(
          catchError(err => {
            console.error('Error loading orders for analytics:', err);
            this.errorMessage = 'Could not load order data for analytics.';
            return of(null); // Return null to indicate failure in this inner stream
          })
        );
      }),
      catchError(authError => { // Catches errors from currentUser$ or its filter
        console.error('Error fetching current user for analytics:', authError);
        this.errorMessage = 'Failed to load user data. Please ensure you are logged in.';
        return of(null); // Return null if user fetching fails
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loader) await loader.dismiss().catch(e => console.warn("Loader dismiss error", e));
        if (refresherEvent) refresherEvent.target.complete();
        this.cdr.detectChanges(); // Ensure UI updates after loading finishes
      })
    ).subscribe(orders => { // orders here can be Order[] or null
      if (orders) {
        this.allOrders = orders; // Assign directly if orders is Order[]
        this.processAnalytics();
      } else {
        this.allOrders = []; // Ensure allOrders is an empty array if orders is null
        if (!this.errorMessage) { // If no specific error was set during fetching
          this.errorMessage = 'No order data available to generate analytics.';
        }
        this.processAnalytics(); // Process with empty orders to show 0 stats
      }
    });
  }

  processAnalytics() {
    if (!this.allOrders || this.allOrders.length === 0) {
      this.analyticsData = {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        ordersByStatus: [],
      };
      this.cdr.detectChanges(); // Update view for empty state
      return;
    }

    const totalOrders = this.allOrders.length;
    // Ensure order.totalAmount exists on your Order interface for this to work without error
    const totalRevenue = this.allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const statusCounts: { [key: string]: number } = {};
    this.allOrders.forEach(order => {
      const statusKey = order.status || 'unknown'; // Handle potentially undefined status
      statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    });

    const ordersByStatus = Object.keys(statusCounts).map(status => ({
      status: status,
      count: statusCounts[status],
      percentage: totalOrders > 0 ? (statusCounts[status] / totalOrders) * 100 : 0
    })).sort((a,b) => b.count - a.count);

    this.analyticsData = {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      ordersByStatus
    };

    console.log('Analytics Processed:', this.analyticsData);
    this.cdr.detectChanges(); // Ensure view updates with new analytics data
  }

  formatCurrency(value: number): string {
    return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) { // Added optional chaining for status
      case 'pending': return 'status-pending';
      case 'processing': return 'status-processing';
      case 'shipped': return 'status-shipped';
      case 'delivered': return 'status-delivered';
      case 'completed': return 'status-completed'; // Ensure 'completed' is a valid status in your Order interface
      case 'cancelled': return 'status-cancelled';
      default: return 'status-other';
    }
  }

  doRefresh(event: any) {
    this.loadInitialData(event);
  }

  // Removed showToast as it wasn't used in this component's logic
  // async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
  //   const toast = await this.toastController.create({ message, duration, color, position: 'top' });
  //   toast.present();
  // }

  ngOnDestroy() {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }
}

