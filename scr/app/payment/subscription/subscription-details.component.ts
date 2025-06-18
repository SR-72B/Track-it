// src/app/payment/subscription-details/subscription-details.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../auth/auth.service';
import { PaymentService, SubscriptionDetails } from '../payment.service';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-subscription-details',
  templateUrl: './subscription-details.component.html',
  styleUrls: ['./subscription-details.component.scss']
})
export class SubscriptionDetailsComponent implements OnInit {
  subscription$: Observable<SubscriptionDetails | null>;
  isCancelling = false;

  constructor(
    private authService: AuthService,
    private paymentService: PaymentService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.subscription$ = this.authService.currentUser$.pipe(
      switchMap(user => {
        if (user) {
          return this.paymentService.getSubscription(user.uid);
        } else {
          return new Observable<null>(observer => {
            observer.next(null);
            observer.complete();
          });
        }
      })
    );
  }

  formatDate(date: any): string {
    if (!date) return '';
    
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString();
  }

  async cancelSubscription(subscription: SubscriptionDetails) {
    const alert = await this.alertController.create({
      header: 'Cancel Subscription',
      message: 'Are you sure you want to cancel your subscription? You will still have access until your current period ends.',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Yes, Cancel',
          handler: async () => {
            this.isCancelling = true;
            const loading = await this.loadingController.create({
              message: 'Cancelling subscription...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              await this.paymentService.cancelSubscription(subscription.id, subscription.userId).toPromise();
              
              await loading.dismiss();
              this.isCancelling = false;

              const successAlert = await this.alertController.create({
                header: 'Subscription Cancelled',
                message: `Your subscription has been cancelled. You will have access until ${this.formatDate(subscription.endDate)}.`,
                buttons: ['OK']
              });
              await successAlert.present();
            } catch (error) {
              await loading.dismiss();
              this.isCancelling = false;
              
              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: error.message || 'There was an error cancelling your subscription. Please try again.',
                buttons: ['OK']
              });
              await errorAlert.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }
}
