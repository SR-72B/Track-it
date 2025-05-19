// src/app/payment/payment.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
// import { AngularFireFunctions } from '@angular/fire/compat/functions'; // Not used in the provided code, can be removed if not needed elsewhere
import { AuthService } from '../auth/auth.service';
import { Observable, from } from 'rxjs';
import { switchMap, map } from 'rxjs/operators'; // Added 'map' import

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
  status: 'active' | 'cancelled' | 'trial' | 'expired' | 'pending_payment'; // Added more statuses for robustness
  startDate: any; // Use 'any' or a specific Firebase Timestamp type if available, to handle Firestore data
  endDate: any;   // Use 'any' or a specific Firebase Timestamp type
  plan: 'retailer' | string; // Allow for other plan types
  amount: number;
  paymentMethod: Partial<CardDetails>; // Stores partial card details for security
  autoRenew: boolean;
  trialEndDate?: any; // Optional: if there's a trial period
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  constructor(
    private firestore: AngularFirestore,
    // private functions: AngularFireFunctions, // Uncomment if you plan to use Cloud Functions
    private authService: AuthService
  ) {}

  /**
   * Get subscription details for a user.
   * Fetches the latest subscription based on the start date.
   * @param userId The ID of the user.
   * @returns An Observable of the SubscriptionDetails or null if not found.
   */
  getSubscription(userId: string): Observable<SubscriptionDetails | null> {
    return this.firestore
      .collection<SubscriptionDetails>('subscriptions', ref =>
        ref.where('userId', '==', userId).orderBy('startDate', 'desc').limit(1)
      )
      .valueChanges({ idField: 'id' }) // Use idField to get document ID if needed elsewhere, though 'id' is already in your interface
      .pipe(
        map(subscriptions => (subscriptions.length > 0 ? subscriptions[0] : null))
      );
  }

  /**
   * Cancel a subscription.
   * Updates the subscription status to 'cancelled' and sets autoRenew to false.
   * Also updates the user's profile to reflect no active subscription.
   * @param subscriptionId The ID of the subscription to cancel.
   * @param userId The ID of the user.
   * @returns An Observable that completes when the operations are done.
   */
  cancelSubscription(subscriptionId: string, userId: string): Observable<void> {
    if (!subscriptionId || !userId) {
        console.error('Subscription ID or User ID is missing for cancellation.');
        return from(Promise.reject(new Error('Subscription ID or User ID is missing.')));
    }
    return from(
      this.firestore.collection('subscriptions').doc(subscriptionId).update({
        status: 'cancelled',
        autoRenew: false
        // Optionally, set an 'cancellationDate': new Date()
      })
    ).pipe(
      switchMap(() => {
        // In a real app, extensive user profile updates related to subscription changes
        // might be better handled server-side (e.g., via Cloud Functions) for reliability.
        return from(
          this.authService.updateProfile(userId, {
            hasActiveSubscription: false
            // Consider clearing subscriptionEndDate or setting it to the actual end date
          })
        );
      })
    );
  }

  /**
   * Renew a subscription.
   * This is a simplified example; real renewals involve payment processing.
   * @param subscriptionId The ID of the subscription to renew.
   * @returns An Observable that completes when the update is done.
   */
  renewSubscription(subscriptionId: string): Observable<void> {
    if (!subscriptionId) {
        console.error('Subscription ID is missing for renewal.');
        return from(Promise.reject(new Error('Subscription ID is missing.')));
    }
    const now = new Date();
    const nextEndDate = new Date();
    nextEndDate.setMonth(now.getMonth() + 1); // Example: 1-month renewal

    return from(
      this.firestore.collection('subscriptions').doc(subscriptionId).update({
        status: 'active',
        startDate: now, // This should likely be the *original* start date or renewal date
        endDate: nextEndDate,
        autoRenew: true // Assuming renewal implies auto-renew is on
      })
    );
  }

  /**
   * Check if a credit card number is valid using the Luhn algorithm.
   * @param cardNumber The credit card number string.
   * @returns True if the card number is valid, false otherwise.
   */
  validateCreditCard(cardNumber: string): boolean {
    if (!cardNumber) return false;
    // Remove any spaces or dashes
    const cleanedCardNumber = cardNumber.replace(/[\s-]/g, '');

    // Check if the card number contains only digits
    if (!/^\d+$/.test(cleanedCardNumber)) return false;

    // Check if the length is valid (typically 13-19 digits)
    if (cleanedCardNumber.length < 13 || cleanedCardNumber.length > 19) return false;

    // Luhn Algorithm Implementation
    let sum = 0;
    let doubled = false;

    // Loop through each digit from right to left
    for (let i = cleanedCardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanedCardNumber.charAt(i), 10);

      if (doubled) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      doubled = !doubled;
    }
    return sum % 10 === 0;
  }

  /**
   * Validate CVC code.
   * @param cvc The CVC string.
   * @param cardType Optional: The type of card (e.g., 'amex') to determine CVC length.
   * @returns True if the CVC is valid, false otherwise.
   */
  validateCVC(cvc: string, cardType: string = 'unknown'): boolean {
    if (!cvc) return false;
    const cleanedCVC = cvc.trim();

    if (!/^\d+$/.test(cleanedCVC)) return false;

    // American Express CVC is 4 digits, others are typically 3
    if (cardType.toLowerCase() === 'amex') {
      return cleanedCVC.length === 4;
    } else {
      return cleanedCVC.length === 3;
    }
  }

  /**
   * Validate credit card expiry date.
   * @param month The expiry month (e.g., "01", "12").
   * @param year The expiry year (e.g., "2025").
   * @returns True if the expiry date is valid and not in the past, false otherwise.
   */
  validateExpiry(month: string, year: string): boolean {
    if (!month || !year) return false;

    const currentDate = new Date();
    // Set to the first day of the current month for accurate comparison with expiry month/year
    currentDate.setDate(1); 
    currentDate.setHours(0, 0, 0, 0);


    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed

    const expMonth = parseInt(month, 10);
    const expYear = parseInt(year, 10);

    if (isNaN(expMonth) || isNaN(expYear)) return false;
    if (expMonth < 1 || expMonth > 12) return false;

    // Card expires at the END of the expiry month.
    // So, if current year is 2025 and current month is May (5),
    // an expiry of 05/2025 is valid until the end of May 2025.
    if (expYear < currentYear) return false;
    if (expYear === currentYear && expMonth < currentMonth) return false;

    return true;
  }

  /**
   * Process a new subscription.
   * Simulates creating a subscription record and updating the user's profile.
   * In a real application, this would involve secure payment gateway integration.
   * @param userId The ID of the user subscribing.
   * @param cardDetails The credit card details for the subscription.
   * @returns An Observable that completes when the operations are done.
   */
  processSubscription(userId: string, cardDetails: CardDetails): Observable<any> {
    if (!userId || !cardDetails) {
        console.error('User ID or Card Details are missing for processing subscription.');
        return from(Promise.reject(new Error('User ID or Card Details are missing.')));
    }
    // In a real application, this would communicate with a payment gateway (e.g., Stripe, Braintree)
    // to create a payment method token, charge the card, and set up recurring payments.
    // For this demo, we'll simulate storing payment method and subscription details.

    const subscriptionId = this.firestore.createId();
    const now = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(now.getDate() + 30); // 30-day trial period

    const subscription: SubscriptionDetails = {
      id: subscriptionId,
      userId: userId,
      status: 'trial', // Initial status is 'trial'
      startDate: now,
      endDate: trialEndDate, // For a trial, this is the trial end date. For active, it's subscription cycle end.
      trialEndDate: trialEndDate,
      plan: 'retailer',
      amount: 14, // Example: $14/month after trial
      paymentMethod: {
        // For security, only store non-sensitive parts like last 4 digits and cardholder name.
        // The full card details should be tokenized and handled by the payment gateway.
        cardNumber: `**** **** **** ${cardDetails.cardNumber.slice(-4)}`,
        expiryMonth: cardDetails.expiryMonth,
        expiryYear: cardDetails.expiryYear,
        name: cardDetails.name
        // CVC should NEVER be stored.
      },
      autoRenew: true // Assume auto-renewal is on by default after trial
    };

    // Store the new subscription in Firestore
    return from(this.firestore.collection('subscriptions').doc(subscriptionId).set(subscription))
      .pipe(
        switchMap(() => {
          // Update the user's record to reflect their new subscription status
          return from(this.authService.updateProfile(userId, {
            hasActiveSubscription: true, // Or 'hasTrial: true'
            subscriptionStatus: 'trial',
            subscriptionEndDate: trialEndDate // Store when the current period (trial or paid) ends
          }));
        })
      );
  }
}
