// src/app/retailer/order-management/order-management.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms'; // Changed to FormsModule for ngModel
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController, ToastController, ModalController, IonicModule } from '@ionic/angular';

import { Observable, Subscription, of, firstValueFrom } from 'rxjs';
import { first, catchError, finalize, switchMap, tap } from 'rxjs/operators';

import { AuthService, User } from '../../auth/auth.service';
// Ensure Order interface in order.service.ts includes:
// id?: string; customerId?: string; customerName?: string; customerEmail?: string;
// status: string; createdAt: any; totalAmount?: number; purchaseOrder?: string;
import { OrderService, Order, OrderUpdate } from '../order-management/order.service';
import { CommunicationService } from '../../communication/communication.service';

@Component({
  selector: 'app-order-management',
  templateUrl: './order-management.component.html',
  styleUrls: ['./order-management.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule, // For [(ngModel)] with searchTerm
    IonicModule,
    RouterModule
  ]
})
export class OrderManagementComponent implements OnInit, OnDestroy {
  allOrders: Order[] = [];
  filteredOrders: Order[] = [];
  isLoading = true;
  activeFilter = 'all'; // Corresponds to ion-segment value
  searchTerm = '';
  errorMessage: string | null = null;

  // Define statuses for the update prompt
  statuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  orderStats = {
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  };

  private currentUser: User | null = null;
  private authSubscription: Subscription | undefined;
  private ordersSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private communicationService: CommunicationService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private modalController: ModalController, // Keep if planning to use
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.uid) {
        this.loadOrders();
      } else {
        this.isLoading = false;
        this.allOrders = [];
        this.filteredOrders = [];
        this.calculateOrderStatistics();
        this.errorMessage = "Please log in to manage orders.";
      }
    });
  }

  async loadOrders(refresherEvent?: any) {
    if (!this.currentUser || !this.currentUser.uid) {
      this.isLoading = false;
      this.errorMessage = "User not authenticated. Cannot load orders.";
      if (refresherEvent) refresherEvent.target.complete();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
      // loader = await this.loadingController.create({ message: 'Loading orders...' });
      // await loader.present();
    }

    if (this.ordersSubscription) {
      this.ordersSubscription.unsubscribe();
    }

    this.ordersSubscription = this.orderService.getRetailerOrders(this.currentUser.uid).pipe(
      finalize(async () => {
        this.isLoading = false;
        // if (loader) await loader.dismiss().catch(e => console.warn("Loader dismiss error", e));
        if (refresherEvent) refresherEvent.target.complete();
        this.cdr.detectChanges(); // Ensure UI updates
      }),
      catchError(error => {
        console.error('Error loading orders:', error);
        this.errorMessage = 'Could not load orders. Please try again.';
        this.allOrders = [];
        this.filteredOrders = [];
        this.calculateOrderStatistics();
        return of([]);
      })
    ).subscribe(orders => {
      this.allOrders = orders.sort((a, b) => {
        const getMs = (timestamp: any): number => {
          if (!timestamp) return 0;
          if (timestamp instanceof Date) return timestamp.getTime();
          if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000).getTime();
          const d = new Date(timestamp);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getMs(b.createdAt) - getMs(a.createdAt);
      });
      this.calculateOrderStatistics();
      this.applyFilters();
    });
  }

  calculateOrderStatistics() {
    this.orderStats.total = this.allOrders.length;
    this.orderStats.pending = this.allOrders.filter(o => o.status === 'pending').length;
    this.orderStats.processing = this.allOrders.filter(o => o.status === 'processing').length;
    this.orderStats.shipped = this.allOrders.filter(o => o.status === 'shipped').length;
    this.orderStats.delivered = this.allOrders.filter(o => o.status === 'delivered').length;
    this.orderStats.cancelled = this.allOrders.filter(o => o.status === 'cancelled').length;
  }

  applyFilters() {
    let filtered = this.allOrders;
    if (this.activeFilter !== 'all') {
      filtered = filtered.filter(order => order.status === this.activeFilter);
    }

    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(order =>
        order.id?.toLowerCase().includes(term) ||
        order.customerName?.toLowerCase().includes(term) ||
        (order.purchaseOrder && order.purchaseOrder.toLowerCase().includes(term)) ||
        order.customerEmail?.toLowerCase().includes(term)
      );
    }
    this.filteredOrders = [...filtered]; // Create new array reference for change detection
    this.cdr.detectChanges();
  }

  filterOrdersByStatus(event: any) {
    this.activeFilter = event.detail.value;
    this.applyFilters();
  }

  searchOrders(event?: any) {
    if (event && event.target) {
        this.searchTerm = event.target.value || '';
    }
    this.applyFilters();
  }

  clearSearch() {
    this.searchTerm = '';
    this.applyFilters();
  }

  doRefresh(event: any) {
    if (this.currentUser && this.currentUser.uid) {
        this.loadOrders(event);
    } else {
        this.showToast('Please log in to refresh orders.', 'warning');
        if (event) event.target.complete();
    }
  }

  viewOrderDetails(orderId: string | undefined) {
    if (orderId) {
      this.router.navigate(['/retailer/orders', orderId]);
    }
  }

  async promptUpdateOrderStatus(order: Order) {
    const alertInputs: any[] = this.statuses.map(s => ({
        name: 'status', type: 'radio', label: s.label, value: s.value, checked: order.status === s.value
    }));

    const alert = await this.alertController.create({
      header: 'Update Order Status',
      inputs: alertInputs,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Next',
          handler: async (selectedStatus) => {
            if (!selectedStatus) {
                this.showToast('Please select a status.', 'warning');
                return false;
            }
            if (selectedStatus === order.status) {
              this.showToast(`Order status is already ${selectedStatus}.`, 'medium');
              return false;
            }
            this.promptForUpdateMessage(order, selectedStatus);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async promptForUpdateMessage(order: Order, newStatus: Order['status']) {
    const messageAlert = await this.alertController.create({
      header: 'Status Update Message',
      message: 'Provide a message for the customer regarding this update.',
      inputs: [ { name: 'message', type: 'textarea', placeholder: 'Your message to the customer...' } ],
      buttons: [
        { text: 'Back', role: 'cancel', handler: () => { this.promptUpdateOrderStatus(order); } },
        {
          text: 'Update Order',
          handler: async (messageData) => {
            if (!messageData.message || messageData.message.trim() === '') {
              this.showToast('An update message is required.', 'warning');
              return false;
            }
            this.processOrderUpdate(order, newStatus, messageData.message.trim());
            return true;
          }
        }
      ]
    });
    await messageAlert.present();
  }

  async processOrderUpdate(order: Order, newStatus: Order['status'], message: string) {
    const loading = await this.loadingController.create({ message: 'Updating order...' });
    await loading.present();
    try {
      await this.orderService.updateOrderStatus(order, newStatus, message);
      this.showToast('Order updated successfully!', 'success');
      if (order.customerId && order.id) {
        firstValueFrom(this.communicationService.createOrderStatusNotification(
          order.customerId, order.id, newStatus, message
        )).catch(err => console.error('Failed to send order status notification:', err));
      }
      this.loadOrders(); // Refresh
    } catch (error: any) {
      this.showErrorAlert('Update Failed', error.message || 'Failed to update order status.');
    } finally {
      await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
    }
  }

  async confirmCancelOrder(order: Order) {
    if (order.status === 'cancelled' || order.status === 'delivered') {
        this.showToast(`Order is already ${order.status} and cannot be cancelled.`, 'medium');
        return;
    }
    const alert = await this.alertController.create({
      header: 'Cancel Order',
      message: 'Please provide a reason for cancellation:',
      inputs: [ { name: 'reason', type: 'textarea', placeholder: 'e.g., Items out of stock' } ],
      buttons: [
        { text: 'Back', role: 'cancel' },
        {
          text: 'Confirm Cancellation',
          cssClass: 'alert-button-danger',
          handler: async (data) => {
            if (!data.reason || data.reason.trim() === '') {
              this.showToast('A cancellation reason is required.', 'warning');
              return false;
            }
            this.processOrderUpdate(order, 'cancelled', data.reason.trim());
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  communicateWithCustomer(order: Order) {
    if (order.customerId) {
      this.router.navigate(['/communication/chat', order.customerId]);
    } else {
      this.showToast('Customer ID not available for this order.', 'warning');
    }
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
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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

  async exportOrders() {
    if (this.filteredOrders.length === 0) {
        this.showToast('No orders to export based on current filters.', 'medium');
        return;
    }
    const csvContent = this.generateOrdersCSV();
    this.downloadCSV(csvContent, `orders-export-${new Date().toISOString().split('T')[0]}.csv`);
    this.showToast('Orders exported successfully.', 'success');
  }

  private generateOrdersCSV(): string {
    const headers = ['Order ID', 'Customer Name', 'Customer Email', 'Status', 'Date Created', 'Total Amount', 'PO Number'];
    const rows = this.filteredOrders.map(order => {
      const date = this.formatDate(order.createdAt);
      return [
        order.id || '',
        order.customerName || '',
        order.customerEmail || '', // Ensure Order interface has customerEmail
        order.status?.toUpperCase() || '',
        date,
        order.totalAmount || 0, // Ensure Order interface has totalAmount
        order.purchaseOrder || 'N/A'
      ].map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`); // Handle null/undefined cells
    });
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private downloadCSV(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
        this.showErrorAlert('Export Failed', 'CSV download is not supported by your browser.');
    }
  }

  async presentStatisticsAlert() {
    const alert = await this.alertController.create({
        header: 'Order Statistics',
        message: `
            Total Orders: ${this.orderStats.total}<br>
            Pending: ${this.orderStats.pending}<br>
            Processing: ${this.orderStats.processing}<br>
            Shipped: ${this.orderStats.shipped}<br>
            Delivered: ${this.orderStats.delivered}<br>
            Cancelled: ${this.orderStats.cancelled}
        `,
        buttons: ['OK']
    });
    await alert.present();
  }

  viewOrderAnalytics() {
    this.router.navigate(['/retailer/analytics']);
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({ message, duration, color, position: 'top' });
    toast.present();
  }

  async showErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.ordersSubscription) {
      this.ordersSubscription.unsubscribe();
    }
  }
}

