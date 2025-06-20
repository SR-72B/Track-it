// src/app/payment/billing/billing.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, LoadingController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { PaymentService, SubscriptionDetails } from '../payment.service';
import { AuthService, User } from '../../auth/auth.service';
import { ErrorService } from '../../shared/services/error.service';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface BillingHistory {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  description: string;
  invoiceUrl?: string;
  paidAt?: any;
  createdAt: any;
  paymentMethod?: string;
}

@Component({
  selector: 'app-billing',
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class BillingComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  subscription: SubscriptionDetails | null = null;
  billingHistory: BillingHistory[] = [];
  isLoading = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private paymentService: PaymentService,
    private authService: AuthService,
    private errorService: ErrorService,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.loadUserData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserData() {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          if (user) {
            this.loadSubscriptionData();
            this.loadBillingHistory();
          }
        },
        error: (error) => {
          this.errorService.handleError(error, 'Loading user data');
        }
      });
  }

  private loadSubscriptionData() {
    if (!this.currentUser) return;

    this.paymentService.getSubscription(this.currentUser.uid)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (subscription) => {
          this.subscription = subscription;
        },
        error: (error) => {
          this.errorService.handleError(error, 'Loading subscription data');
        }
      });
  }

  private loadBillingHistory() {
    if (!this.currentUser) return;

    // Mock billing history - replace with actual service call
    this.billingHistory = [
      {
        id: '1',
        subscriptionId: 'sub_123',
        amount: 29.00,
        currency: 'USD',
        status: 'paid',
        description: 'Retailer Basic Monthly - January 2025',
        paidAt: new Date('2025-01-01'),
        createdAt: new Date('2025-01-01'),
        paymentMethod: '**** 4242'
      },
      {
        id: '2',
        subscriptionId: 'sub_123',
        amount: 29.00,
        currency: 'USD',
        status: 'paid',
        description: 'Retailer Basic Monthly - December 2024',
        paidAt: new Date('2024-12-01'),
        createdAt: new Date('2024-12-01'),
        paymentMethod: '**** 4242'
      }
    ];
  }

  async downloadInvoice(invoice: BillingHistory) {
    if (!invoice.invoiceUrl) {
      this.errorService.showWarning('Invoice not available for download');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Downloading invoice...'
    });
    await loading.present();

    try {
      // Mock download - replace with actual implementation
      window.open(invoice.invoiceUrl, '_blank');
      this.errorService.showSuccess('Invoice downloaded successfully');
    } catch (error) {
      this.errorService.handleError(error, 'Downloading invoice');
    } finally {
      await loading.dismiss();
    }
  }

  async requestRefund(invoice: BillingHistory) {
    const alert = await this.alertController.create({
      header: 'Request Refund',
      message: `Are you sure you want to request a refund for ${invoice.description}?`,
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Please provide a reason for the refund request...'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Request Refund',
          handler: async (data) => {
            if (!data.reason || data.reason.trim() === '') {
              this.errorService.showWarning('Please provide a reason for the refund');
              return false;
            }
            await this.processRefundRequest(invoice, data.reason);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async processRefundRequest(invoice: BillingHistory, reason: string) {
    const loading = await this.loadingController.create({
      message: 'Processing refund request...'
    });
    await loading.present();

    try {
      // Mock refund request - replace with actual service call
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.errorService.showSuccess('Refund request submitted successfully. We will review it within 3-5 business days.');
    } catch (error) {
      this.errorService.handleError(error, 'Processing refund request');
    } finally {
      await loading.dismiss();
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      case 'refunded': return 'medium';
      default: return 'medium';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'paid': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'failed': return 'close-circle';
      case 'refunded': return 'return-up-back';
      default: return 'help-circle';
    }
  }

  formatDate(date: any): string {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  getDaysRemaining(): number {
    if (!this.subscription?.endDate) return 0;
    return this.paymentService.getDaysRemaining(this.subscription);
  }

  getNextBillingDate(): string {
    if (!this.subscription?.nextBillingDate) return 'N/A';
    return this.formatDate(this.subscription.nextBillingDate);
  }
}
