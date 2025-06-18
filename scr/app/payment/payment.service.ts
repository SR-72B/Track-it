// src/app/payment/payment.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { AuthService } from '../auth/auth.service';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export interface CardDetails {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
  name: string;
}

export interface SubscriptionDetails {
  id: string;
  userId: string;
  status: 'active' | 'cancelled' | 'trial' | 'expired';
  startDate: Date;
  endDate: Date;
  plan: 'retailer';
  amount: number;
  paymentMethod: Partial<CardDetails>;
  autoRenew: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  constructor(
    private firestore: AngularFirestore,
    private functions: AngularFireFunctions,
    private authService: AuthService
  ) {}

  /**
   * Get subscription details for a user
   */
  getSubscription(userId: string): Observable<SubscriptionDetails | null> {
    return this.firestore
      .collection<SubscriptionDetails>('subscriptions', ref => 
        ref.where('userId', '==', userId).orderBy('startDate', 'desc').limit(1)
      )
      .valueChanges()
      .pipe(
        map(subscriptions => subscriptions.length > 0 ? subscriptions[0] : null)
      );
  }

  /**
   * Cancel subscription
   */
  cancelSubscription(subscriptionId: string, userId: string): Observable<void> {
    return from(
      this.firestore.collection('subscriptions').doc(subscriptionId).update({
        status: 'cancelled',
        autoRenew: false
      })
    ).pipe(
      switchMap(() => {
        // This would normally be handled by a Cloud Function that would run on subscription expiry
        // For this demo, we're updating the user profile immediately
        return from(
          this.authService.updateProfile(userId, {
            hasActiveSubscription: false
          })
        );
      })
    );
  }

  /**
   * Renew subscription (would normally happen automatically)
   */
  renewSubscription(subscriptionId: string): Observable<void> {
    const now = new Date();
    const nextEndDate = new Date();
    nextEndDate.setMonth(now.getMonth() + 1); // 1 month subscription
    
    return from(
      this.firestore.collection('subscriptions').doc(subscriptionId).update({
        status: 'active',
        startDate: now,
        endDate: nextEndDate
      })
    );
  }
}
   * Check if a credit card number is valid using the Luhn algorithm
   */
  validateCreditCard(cardNumber: string): boolean {
    // Remove any spaces or dashes
    cardNumber = cardNumber.replace(/[\s-]/g, '');
    
    // Check if the card number contains only digits
    if (!/^\d+$/.test(cardNumber)) return false;
    
    // Check if the length is valid (13-19 digits)
    if (cardNumber.length < 13 || cardNumber.length > 19) return false;
    
    // Luhn Algorithm Implementation
    let sum = 0;
    let doubled = false;
    
    // Loop through each digit from right to left
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i));
      
      // Double every second digit
      if (doubled) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      doubled = !doubled;
    }
    
    // The card is valid if the sum is divisible by 10
    return sum % 10 === 0;
  }

  /**
   * Validate CVC code
   */
  validateCVC(cvc: string, cardType: string = 'unknown'): boolean {
    // Remove any spaces
    cvc = cvc.trim();
    
    // Check if it contains only digits
    if (!/^\d+$/.test(cvc)) return false;
    
    // Check length based on card type
    if (cardType.toLowerCase() === 'amex') {
      return cvc.length === 4;
    } else {
      return cvc.length === 3;
    }
  }

  /**
   * Validate expiry date
   */
  validateExpiry(month: string, year: string): boolean {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JS months are 0-based
    
    const expMonth = parseInt(month, 10);
    const expYear = parseInt(year, 10);
    
    // Check if month is valid
    if (expMonth < 1 || expMonth > 12) return false;
    
    // Check if the expiry date is in the past
    if (expYear < currentYear) return false;
    if (expYear === currentYear && expMonth < currentMonth) return false;
    
    return true;
  }

  /**
   * Process subscription payment (in real app, would integrate with payment gateway)
   */
  processSubscription(userId: string, cardDetails: CardDetails): Observable<any> {
    // In a real application, this would communicate with a payment gateway
    // For this demo, we'll simulate storing payment method and subscription
    
    // First, create a subscription record
    const subscriptionId = this.firestore.createId();
    const now = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(now.getDate() + 30); // 30-day trial
    
    const subscription: SubscriptionDetails = {
      id: subscriptionId,
      userId: userId,
      status: 'trial',
      startDate: now,
      endDate: trialEndDate,
      plan: 'retailer',
      amount: 14, // $14/month
      paymentMethod: {
        // Store only last 4 digits for security
        cardNumber: `xxxxxxxxxxxx${cardDetails.cardNumber.slice(-4)}`,
        expiryMonth: cardDetails.expiryMonth,
        expiryYear: cardDetails.expiryYear,
        name: cardDetails.name
      },
      autoRenew: true
    };
    
    // Store subscription in Firestore
    return from(this.firestore.collection('subscriptions').doc(subscriptionId).set(subscription))
      .pipe(
        switchMap(() => {
          // Update user record to reflect subscription status
          return from(this.authService.updateProfile(userId, {
            hasActiveSubscription: true,
            subscriptionEndDate: trialEndDate
          }));
        })
      );
  }

  /*