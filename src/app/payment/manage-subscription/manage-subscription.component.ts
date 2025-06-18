// src/app/payment/manage-subscription/manage-subscription.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'; // Added ChangeDetectorRef
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common'; // For *ngIf, *ngFor, async pipe
import { IonicModule, LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Observable, Subscription, of, firstValueFrom } from 'rxjs';
import { switchMap, catchError, finalize, tap, filter, map } from 'rxjs/operators';

import { AuthService, User } from '../../auth/auth.service';
// Ensure SubscriptionDetails and Plan interfaces are correctly defined and EXPORTED from payment.service.ts
import { PaymentService, SubscriptionDetails, Plan } from '../payment.service';

@Component({
  selector: 'app-manage-subscription',
  templateUrl: './manage-subscription.component.html',
  styleUrls: ['./manage-subscription.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class ManageSubscriptionComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  subscription$: Observable<SubscriptionDetails | null | undefined> = of(undefined);
  availablePlans$: Observable<Plan[]> = of([]);

  isLoading = true;
  isProcessingAction = false;
  currentActionPlanId: string | null = null; // To track which plan button shows a spinner
  errorMessage: string | null = null;

  private userSubscription: Subscription | undefined;
  // private actionSubscription: Subscription | undefined; // Not currently used for a long-lived subscription

  constructor(
    private authService: AuthService,
    private paymentService: PaymentService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef // Injected ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.userSubscription = this.authService.currentUser$.pipe(
      tap(user => this.currentUser = user),
      filter((user): user is User => !!user && !!user.uid),
      switchMap(user => {
        return this.authService.isRetailer().pipe(
          map(isRetailer => ({ user, isRetailer }))
        );
      }),
      catchError(authError => {
        console.error("Error in user authentication pipeline:", authError);
        this.errorMessage = "Failed to determine user status.";
        this.isLoading = false;
        this.cdr.detectChanges();
        return of({ user: null, isRetailer: false });
      })
    ).subscribe(async ({ user, isRetailer }) => {
      if (!user) {
        this.errorMessage = "You must be logged in to manage subscriptions.";
        this.isLoading = false;
        this.cdr.detectChanges();
        this.router.navigate(['/auth/login']);
        return;
      }
      if (!isRetailer) {
        this.errorMessage = "Subscription management is only available for retailers.";
        this.isLoading = false;
        this.cdr.detectChanges();
        await this.showToast('Access denied. This page is for retailers only.', 'warning');
        this.router.navigate(['/customer/dashboard']);
        return;
      }
      this.currentUser = user; // Ensure currentUser is set
      this.loadSubscriptionDetails();
      this.loadAvailablePlans();
    });
  }

  async loadSubscriptionDetails(refresherEvent?: any) {
    if (!this.currentUser || !this.currentUser.uid) {
      this.errorMessage = "User information is not available.";
      this.isLoading = false;
      if (refresherEvent) refresherEvent.target.complete();
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
      loader = await this.loadingController.create({ message: 'Loading subscription details...' });
      await loader.present();
    }

    this.subscription$ = this.paymentService.getSubscription(this.currentUser.uid).pipe(
      tap(() => this.cdr.detectChanges()), // Ensure view updates after data fetch
      catchError(err => {
        console.error('Error fetching subscription:', err);
        this.errorMessage = 'Failed to load subscription details.';
        this.cdr.detectChanges();
        return of(null);
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loader) await loader.dismiss().catch(e => console.warn("Loader dismiss error", e));
        if (refresherEvent) refresherEvent.target.complete();
        this.cdr.detectChanges();
      })
    );
  }

  async loadAvailablePlans() {
    if (typeof this.paymentService.getAvailablePlans !== 'function') {
        console.error('PaymentService.getAvailablePlans is not a function. Please implement it.');
        this.availablePlans$ = of([]);
        this.showToast('Could not load plan options at this time.', 'danger');
        return;
    }
    this.availablePlans$ = this.paymentService.getAvailablePlans('retailer').pipe(
      tap(() => this.cdr.detectChanges()),
      catchError(err => {
        console.error('Error fetching available plans:', err);
        this.showToast('Could not load available plans.', 'danger');
        this.cdr.detectChanges();
        return of([]);
      })
    );
  }

  async handleChangePlan(newPlanId: string, currentSubscription?: SubscriptionDetails | null) {
    if (!this.currentUser || !this.currentUser.uid) {
      this.showToast('User information missing.', 'danger');
      return;
    }
    this.currentActionPlanId = newPlanId;
    this.isProcessingAction = true;
    const loading = await this.loadingController.create({ message: 'Updating subscription...' });
    await loading.present();

    try {
      if (currentSubscription && currentSubscription.id) {
        if (typeof this.paymentService.updateSubscription !== 'function') {
            throw new Error('updateSubscription method is not available in PaymentService.');
        }
        await firstValueFrom(this.paymentService.updateSubscription(this.currentUser.uid, currentSubscription.id, newPlanId));
      } else {
         if (typeof this.paymentService.createSubscription !== 'function') {
            throw new Error('createSubscription method is not available in PaymentService.');
        }
        await firstValueFrom(this.paymentService.createSubscription(this.currentUser.uid, newPlanId));
      }
      this.showToast('Subscription updated successfully!', 'success');
      this.loadSubscriptionDetails(); // Refresh details
    } catch (error: any) {
      console.error('Error changing plan:', error);
      this.showErrorAlert('Update Failed', error.message || 'Could not update subscription.');
    } finally {
      this.isProcessingAction = false;
      this.currentActionPlanId = null;
      await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
      this.cdr.detectChanges();
    }
  }

  async viewInvoices() {
    if (!this.currentUser || !this.currentUser.uid) {
      this.showToast('User information missing.', 'danger');
      return;
    }
    this.showToast('Viewing invoices - to be implemented.', 'medium');
    // Example:
    // if (typeof this.paymentService.getBillingPortalUrl === 'function') {
    //   try {
    //     const portalUrl = await firstValueFrom(this.paymentService.getBillingPortalUrl(this.currentUser.uid));
    //     if (portalUrl) window.open(portalUrl, '_blank'); else this.showToast('Billing portal not available.', 'warning');
    //   } catch (e) { this.showToast('Could not retrieve billing portal URL.', 'danger');}
    // } else { this.showToast('Billing portal functionality not implemented.', 'warning'); }
  }

  async cancelSubscription(subscription: SubscriptionDetails | null | undefined) {
    if (!subscription || !subscription.id || !subscription.userId) {
      this.showToast('Subscription details are missing. Cannot cancel.', 'danger');
      return;
    }
    if (['cancelled', 'ended', 'incomplete_expired'].includes(subscription.status.toLowerCase())) {
      this.showToast('Subscription is already cancelled or has ended.', 'medium');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cancel Subscription',
      message: 'Are you sure you want to cancel? Access remains until your current period ends.',
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Yes, Cancel',
          cssClass: 'alert-button-danger',
          handler: async () => {
            this.currentActionPlanId = 'cancel'; // For spinner on cancel button
            this.isProcessingAction = true;
            const loading = await this.loadingController.create({ message: 'Cancelling subscription...' });
            await loading.present();
            try {
              await firstValueFrom(this.paymentService.cancelSubscription(subscription.id!, subscription.userId));
              this.showToast('Subscription cancellation request processed.', 'success');
              this.loadSubscriptionDetails();
            } catch (error: any) {
              console.error('Error cancelling subscription:', error);
              this.showErrorAlert('Cancellation Failed', error.message || 'Could not cancel subscription.');
            } finally {
              this.isProcessingAction = false;
              this.currentActionPlanId = null;
              await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
              this.cdr.detectChanges();
            }
          }
        }
      ]
    });
    await alert.present();
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
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  getStatusColor(status: string | undefined): string {
    if (!status) return 'medium';
    const lowerStatus = status.toLowerCase();
    switch (lowerStatus) {
      case 'active':
      case 'trialing':
        return 'success';
      case 'past_due':
      case 'incomplete':
        return 'warning';
      case 'cancelled':
      case 'unpaid':
      case 'incomplete_expired':
      case 'ended':
        return 'danger';
      default:
        return 'medium';
    }
  }

  doRefresh(event: any) {
    this.loadSubscriptionDetails(event);
    this.loadAvailablePlans();
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
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    // No actionSubscription to unsubscribe from in this version
  }
}

