// src/app/payment/subscription/subscription.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController, IonicModule } from '@ionic/angular';
import { AuthService } from '../../auth/auth.service';
import { PaymentService, CardDetails } from '../payment.service';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-subscription',
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule
  ]
})
export class SubscriptionComponent implements OnInit {
  paymentForm: FormGroup;
  isSubmitting = false;
  currentYear = new Date().getFullYear();
  years: number[] = [];
  months: string[] = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  user: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private paymentService: PaymentService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {
    // Generate years for expiry selection (current year + 20 years)
    for (let i = 0; i < 20; i++) {
      this.years.push(this.currentYear + i);
    }

    this.paymentForm = this.fb.group({
      cardName: ['', Validators.required],
      cardNumber: ['', [
        Validators.required, 
        Validators.minLength(13),
        Validators.maxLength(19),
        this.validateCardNumber.bind(this)
      ]],
      expiryMonth: ['', Validators.required],
      expiryYear: ['', Validators.required],
      cvc: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(4),
        Validators.pattern(/^\d+$/)
      ]]
    }, { validators: this.validateExpiryDate.bind(this) });
  }

  ngOnInit() {
    this.authService.currentUser$.pipe(first()).subscribe(user => {
      this.user = user;
    });
  }

  validateCardNumber(control: any) {
    if (!control.value) return null;
    return this.paymentService.validateCreditCard(control.value) ? null : { 'invalidCard': true };
  }

  validateExpiryDate(group: FormGroup) {
    const month = group.get('expiryMonth')?.value;
    const year = group.get('expiryYear')?.value;
    
    if (!month || !year) return null;
    
    return this.paymentService.validateExpiry(month, year) ? null : { 'expiredCard': true };
  }

  formatCardNumber(event: any) {
    let value = event.target.value.replace(/\s+/g, '');
    if (value.length > 0) {
      // Format the card number with spaces for readability
      value = value.match(/.{1,4}/g)?.join(' ') || value;
      event.target.value = value;
    }
  }

  async subscribe() {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const loading = await this.loadingController.create({
      message: 'Processing subscription...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const cardDetails: CardDetails = {
        name: this.paymentForm.value.cardName,
        cardNumber: this.paymentForm.value.cardNumber.replace(/\s+/g, ''),
        expiryMonth: this.paymentForm.value.expiryMonth,
        expiryYear: this.paymentForm.value.expiryYear.toString(),
        cvc: this.paymentForm.value.cvc
      };

      await this.paymentService.processSubscription(this.user.uid, cardDetails).toPromise();
      
      await loading.dismiss();
      this.isSubmitting = false;

      const alert = await this.alertController.create({
        header: 'Subscription Activated',
        message: 'Your 30-day free trial has started. You will be charged $14/month after the trial period unless you cancel.',
        buttons: [
          {
            text: 'OK',
            handler: () => {
              this.router.navigate(['/retailer/dashboard']);
              return true; // Fixed: Added return value
            }
          }
        ]
      });
      await alert.present();
    } catch (error: any) {
      await loading.dismiss();
      this.isSubmitting = false;
      
      const alert = await this.alertController.create({
        header: 'Subscription Failed',
        message: error.message || 'There was an error processing your subscription. Please try again.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }
}


