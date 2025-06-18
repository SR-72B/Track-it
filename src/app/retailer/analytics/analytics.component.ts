// src/app/retailer/analytics/analytics.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router'; // Keep if template uses routerLink
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { IonicModule, LoadingController } from '@ionic/angular'; // Removed AlertController, ToastController from Ionic imports if not used
import { Observable, Subscription, of } from 'rxjs'; // Removed unused forkJoin
import { map, first, filter, catchError, finalize, switchMap, tap } from 'rxjs/operators';

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
    CurrencyPipe, // Available for template use
    DecimalPipe   // Available for template use
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
  // public salesByStatusChartLabels: string[] = [];
  // public salesByStatusChartData: any[] = [{ data: [], label: 'Orders' }];
  // public salesOverTimeChartData: any[] = [{ data: [], label: 'Revenue' }];
  // public salesOverTimeChartLabels: string[] = [];
  // public chartOptions = { responsive: true, maintainAspectRatio: false };
  // public chartLegend = true;
  // public chartPlugins = [];

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    // private router: Router, // Removed as not used in this snippet
    private loadingController: LoadingController,
    // private alertController: AlertController, // Removed as not used in this snippet
    // private toastController: ToastController, // Removed as not used in this snippet
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
      first((user): user is User => !!user && !!user.uid),
      switchMap(user => {
        this.currentUser = user;
        return this.orderService.getRetailerOrders(user.uid).pipe(
          catchError(err => {
            console.error('Error loading orders for analytics:', err);
            this.errorMessage = 'Could not load order data for analytics.';
            return of(null);
          })
        );
      }),
      catchError(authError => {
        console.error('Error fetching current user for analytics:', authError);
        this.errorMessage = 'Failed to load user data. Please ensure you are logged in.';
        return of(null);
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loader) await loader.dismiss().catch(e => console.warn("Loader dismiss error", e));
        if (refresherEvent) refresherEvent.target.complete();
        this.cdr.detectChanges();
      })
    ).subscribe(orders => {
      if (orders) {
        this.allOrders = orders;
        this.processAnalytics();
      } else {
        this.allOrders = [];
        if (!this.errorMessage) {
          this.errorMessage = 'No order data available to generate analytics.';
        }
        this.processAnalytics();
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
      this.cdr.detectChanges();
      return;
    }

    const totalOrders = this.allOrders.length;
    const totalRevenue = this.allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const statusCounts: { [key: string]: number } = {};
    this.allOrders.forEach(order => {
      const statusKey = order.status || 'unknown';
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
    this.cdr.detectChanges();
  }

  // formatCurrency method removed as CurrencyPipe is imported and preferred for template formatting

  getStatusClass(status: string | undefined): string {
    switch (status?.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'processing': return 'status-processing';
      case 'shipped': return 'status-shipped';
      case 'delivered': return 'status-delivered';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-other';
    }
  }

  doRefresh(event: any) {
    this.loadInitialData(event);
  }

  ngOnDestroy() {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }
}
