// src/app/retailer/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, AlertController, ToastController } from '@ionic/angular'; // Added AlertController, ToastController

import { Observable, Subscription, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, first, finalize, switchMap, catchError, tap } from 'rxjs/operators';

import { AuthService, User } from '../../auth/auth.service';
import { OrderService, Order } from '../order-management/order.service';
import { FormBuilderService, OrderForm } from '../form-builder/form-builder.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class DashboardComponent implements OnInit, OnDestroy {
  user$: Observable<User | null>;
  recentOrders: Order[] = [];
  activeForms: OrderForm[] = [];
  orderCounts: { [key: string]: number } = {
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  };
  isLoading = true;
  errorMessage: string | null = null;

  private dashboardDataSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    public formBuilderService: FormBuilderService, // Ensure it's public (or remove 'private')
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController, // Added AlertController
    private toastController: ToastController, // Added ToastController
    private cdr: ChangeDetectorRef
  ) {
    this.user$ = this.authService.currentUser$;
  }

  ngOnInit() {
    this.loadDashboardData();
  }

  async loadDashboardData(refresherEvent?: any) {
    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
      loader = await this.loadingController.create({
        message: 'Loading dashboard data...',
        spinner: 'crescent',
        backdropDismiss: false
      });
      await loader.present();
    }

    if (this.dashboardDataSubscription) {
      this.dashboardDataSubscription.unsubscribe();
    }

    this.dashboardDataSubscription = this.authService.currentUser$.pipe(
      first((user): user is User => !!user && !!user.uid),
      switchMap(user => {
        const ordersData$ = this.orderService.getRetailerOrders(user.uid).pipe(
          tap(orders => {
            this.allOrders = orders; // Store all orders for accurate counting
            this.calculateOrderStatistics(orders); // Calculate stats based on all fetched orders
            this.cdr.detectChanges();
          }),
          map(orders => orders.sort((a, b) => {
            const getMs = (timestamp: any): number => {
              if (!timestamp) return 0;
              if (timestamp instanceof Date) return timestamp.getTime();
              if (typeof (timestamp as any).seconds === 'number') {
                return new Date((timestamp as any).seconds * 1000 + ((timestamp as any).nanoseconds || 0) / 1000000).getTime();
              }
              const d = new Date(timestamp);
              return isNaN(d.getTime()) ? 0 : d.getTime();
            };
            return getMs(b.createdAt) - getMs(a.createdAt);
          }).slice(0, 5)), // Take 5 most recent for display
          catchError(err => {
            console.error('Error loading recent orders:', err);
            this.errorMessage = 'Failed to load recent orders.';
            this.orderCounts = { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 }; // Reset counts
            return of([]);
          })
        );

        const formsData$ = this.formBuilderService.getRetailerForms(user.uid).pipe(
          map((forms: OrderForm[]) => forms.filter(form => form.active).sort((a,b) => (a.title || '').localeCompare(b.title || '')).slice(0, 3)),
          catchError(err => {
            console.error('Error loading active forms:', err);
            if (!this.errorMessage) this.errorMessage = 'Failed to load active forms.';
            return of([]);
          })
        );
        return combineLatest([ordersData$, formsData$]);
      }),
      catchError(userError => {
        console.error('Error fetching user for dashboard:', userError);
        this.errorMessage = 'Could not load user data for the dashboard. Please log in again.';
        this.user$ = of(null); // Clear user observable on error
        this.recentOrders = [];
        this.activeForms = [];
        this.orderCounts = { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
        return of([[], []] as [Order[], OrderForm[]]);
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loader) {
          await loader.dismiss().catch(e => console.warn("Loader dismiss error", e));
        }
        if (refresherEvent) {
          refresherEvent.target.complete();
        }
        this.cdr.detectChanges();
      })
    ).subscribe(
      ([recentOrdersData, activeFormsData]) => {
        this.recentOrders = recentOrdersData;
        this.activeForms = activeFormsData;
        // Statistics are now calculated in the 'tap' operator of ordersData$
      },
      (error) => {
        console.error('Critical error loading dashboard data:', error);
        this.errorMessage = 'An unexpected error occurred while loading dashboard data.';
        this.recentOrders = [];
        this.activeForms = [];
        this.orderCounts = { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
      }
    );
  }

  // Added allOrders property to component and pass it here
  public allOrders: Order[] = [];

  calculateOrderStatistics(orders: Order[]) { // Takes orders as parameter
    this.orderCounts.total = orders.length;
    this.orderCounts.pending = orders.filter(o => o.status === 'pending').length;
    this.orderCounts.processing = orders.filter(o => o.status === 'processing').length;
    this.orderCounts.shipped = orders.filter(o => o.status === 'shipped').length;
    this.orderCounts.delivered = orders.filter(o => o.status === 'delivered').length;
    this.orderCounts.cancelled = orders.filter(o => o.status === 'cancelled').length;
  }


  viewAllOrders() {
    this.router.navigate(['/retailer/orders']);
  }

  viewOrder(orderId: string | undefined) {
    if (orderId) {
      this.router.navigate(['/retailer/orders', orderId]);
    } else {
        console.warn('View order called with undefined orderId');
        this.showToast('Cannot view order: Order ID is missing.', 'danger');
    }
  }

  viewAllForms() {
    this.router.navigate(['/retailer/forms']);
  }

  editForm(formId: string | undefined) {
    if (formId) {
      this.router.navigate(['/retailer/forms/edit', formId]);
    } else {
        console.warn('Edit form called with undefined formId');
        this.showToast('Cannot edit form: Form ID is missing.', 'danger');
    }
  }

  createForm() {
    this.router.navigate(['/retailer/forms/create']);
  }

  formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';
    let d: Date;
    if (dateInput && typeof dateInput.seconds === 'number') {
      d = new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1000000);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) {
      console.warn('Invalid date input for formatDate in dashboard:', dateInput);
      return 'Invalid Date';
    }
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'primary';
      case 'shipped': return 'tertiary';
      case 'delivered': return 'success';
      case 'cancelled': return 'danger';
      default: return 'medium';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'processing': return 'sync-circle-outline';
      case 'shipped': return 'airplane-outline';
      case 'delivered': return 'checkmark-done-circle-outline';
      case 'cancelled': return 'close-circle-outline';
      default: return 'ellipse-outline';
    }
  }

  async presentStatisticsAlert() {
    const alert = await this.alertController.create({
        header: 'Order Statistics Summary',
        message: `
            Total Orders: ${this.orderCounts.total}<br>
            Pending: ${this.orderCounts.pending}<br>
            Processing: ${this.orderCounts.processing}<br>
            Shipped: ${this.orderCounts.shipped}<br>
            Delivered: ${this.orderCounts.delivered}<br>
            Cancelled: ${this.orderCounts.cancelled}
        `,
        buttons: ['OK']
    });
    await alert.present();
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({ message, duration, color, position: 'top' });
    toast.present();
  }

  doRefresh(event: any) {
    this.loadDashboardData(event);
  }

  ngOnDestroy() {
    if (this.dashboardDataSubscription) {
      this.dashboardDataSubscription.unsubscribe();
    }
  }
}
