// src/app/payment/subscription-details/subscription-details.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core'; // Added OnDestroy
import { Router, RouterModule } from '@angular/router'; // Added RouterModule
import { CommonModule } from '@angular/common'; // Added CommonModule
import { AlertController, LoadingController, IonicModule, ToastController } from '@ionic/angular'; // Added IonicModule, ToastController

import { AuthService, User } from '../../auth/auth.service'; // Ensure User is exported or defined
import { PaymentService, SubscriptionDetails } from '../payment.service'; // Ensure SubscriptionDetails is exported
import { Observable, Subscription, of, firstValueFrom } from 'rxjs'; // Added Subscription, of, firstValueFrom
import { switchMap, catchError, finalize, tap } from 'rxjs/operators'; // Added catchError, finalize, tap

@Component({
  selector: 'app-subscription-details',
  templateUrl: './subscription-details.component.html', // Ensure this file exists
  styleUrls: ['./subscription-details.component.scss'],   // Ensure this file exists
  standalone: true, // Mark component as standalone
  imports: [
    CommonModule,     // For *ngIf, *ngFor, async pipe, etc.
    IonicModule,      // For Ionic components (ion-card, ion-button, ion-spinner, etc.)
    RouterModule      // For routerLink (if used in the template)
  ]
})
export class SubscriptionDetailsComponent implements OnInit, OnDestroy {
  subscription$: Observable<SubscriptionDetails | null | undefined> = of(undefined); // Initialize for async pipe
  isLoading = true;
  isCancelling = false;
  errorMessage: string | null = null;

  private currentUserSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private paymentService: PaymentService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController // Added ToastController
  ) {}

  ngOnInit() {
    this.loadSubscriptionDetails();
  }

  async loadSubscriptionDetails(refresherEvent?: any) {
    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
        loader = await this.loadingController.create({ message: 'Loading subscription...' });
        await loader.present();
    }

    // Unsubscribe from previous subscription if it exists
    if (this.currentUserSubscription) {
        this.currentUserSubscription.unsubscribe();
    }

    this.currentUserSubscription = this.authService.currentUser$.pipe(
      switchMap(user => {
        if (user && user.uid) {
          return this.paymentService.getSubscription(user.uid).pipe(
            catchError(err => {
              console.error('Error fetching subscription details:', err);
              this.errorMessage = 'Could not load subscription details. Please try again.';
              return of(null); // Emit null on error
            })
          );
        } else {
          this.errorMessage = 'User not logged in. Cannot fetch subscription.';
          return of(null); // No user, so no subscription
        }
      }),
      tap(subscription => { // Use tap for side-effects like logging or checking data
        if (!subscription && !this.errorMessage) {
            // This case might occur if getSubscription returns null for a user with no subscription
            // Or if the user was null initially.
            // this.errorMessage = 'No active subscription found.'; // Or handle as a valid empty state
        }
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loader) {
          await loader.dismiss().catch(e => console.warn("Error dismissing loader:", e));
        }
        if (refresherEvent) {
          refresherEvent.target.complete();
        }
      })
    ).subscribe(data => {
        this.subscription$ = of(data); // Update the observable for the async pipe
    }, err => {
        // This top-level error handler catches issues from currentUser$ itself if it errors.
        console.error("Critical error in subscription loading pipeline:", err);
        this.errorMessage = "An unexpected error occurred while checking user status.";
        this.isLoading = false; // Ensure loading is stopped
        this.subscription$ = of(null);
    });
  }

  formatDate(dateInput: any): string {
    if (!dateInput) return 'N/A';
    let d: Date;
    if (dateInput && typeof dateInput.seconds === 'number') { // Firebase Timestamp
      d = new Date(dateInput.seconds * 1000);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) {
      return 'Invalid Date';
    }
    return d.toLocaleDateString(); // Or your preferred format
  }

  async cancelSubscription(subscription: SubscriptionDetails | null | undefined) {
    if (!subscription || !subscription.id || !subscription.userId) {
      this.showToast('Subscription details are missing. Cannot cancel.', 'danger');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cancel Subscription',
      message: 'Are you sure you want to cancel your subscription? You will retain access until your current period ends.',
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Yes, Cancel',
          cssClass: 'alert-button-danger',
          handler: async () => {
            this.isCancelling = true;
            const loading = await this.loadingController.create({
              message: 'Cancelling subscription...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              // Using firstValueFrom for modern RxJS promise conversion
              await firstValueFrom(this.paymentService.cancelSubscription(subscription.id, subscription.userId));
              
              this.showToast('Subscription cancelled successfully.', 'success');
              // Refresh subscription details to show updated status
              this.loadSubscriptionDetails(); 
            } catch (error: any) {
              console.error('Error cancelling subscription:', error);
              this.showErrorAlert('Cancellation Failed', error.message || 'There was an error cancelling your subscription.');
            } finally {
              this.isCancelling = false;
              await loading.dismiss().catch(e => console.warn("Error dismissing cancel loader:", e));
            }
          }
        }
      ]
    });
    await alert.present();
  }

  manageSubscription() {
    // This could navigate to an external Stripe portal or an internal "change plan" page
    this.showToast('Redirecting to manage subscription...', 'medium');
    // Example: this.router.navigate(['/payment/manage']);
    // Or: window.open(externalManagementUrl, '_blank');
    console.log('Manage subscription clicked - implement navigation or portal link');
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({
      message: message,
      duration: duration,
      color: color,
      position: 'top'
    });
    await toast.present();
  }

  async showErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({
        header: header,
        message: message,
        buttons: ['OK']
    });
    await alert.present();
  }

  doRefresh(event: any) {
    this.loadSubscriptionDetails(event);
  }

  ngOnDestroy() {
    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe();
    }
  }
}

