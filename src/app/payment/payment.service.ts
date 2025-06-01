// src/app/payment/payment.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../auth/auth.service'; // Assuming User interface might be here or in a shared model
import { Observable, from, of, firstValueFrom } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';

export interface CardDetails {
  cardNumber: string; // Should ideally be a token from a payment provider
  expiryMonth: string;
  expiryYear: string;
  cvc: string; // Should NOT be stored
  name: string;
}

// Interface for available subscription plans
export interface Plan {
  id: string; // e.g., 'plan_basic_monthly', 'plan_premium_yearly'
  name: string; // e.g., 'Basic Monthly', 'Premium Yearly'
  price: number;
  currency: string; // e.g., 'USD'
  interval: 'month' | 'year' | string; // 'month' or 'year'
  description?: string;
  features?: string[];
  userType?: 'retailer' | 'customer' | 'all'; // To filter plans
  // Add any other relevant plan properties
}

export interface SubscriptionDetails {
  id: string; // Firestore document ID
  userId: string;
  planId: string; // ID of the plan from your 'plans' collection or config
  planName?: string; // e.g., "Retailer Basic"
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'ended' | string;
  startDate: any; // Firestore Timestamp or Date
  endDate?: any; // End of current billing cycle or trial
  amount?: number; // Add this if the template uses 'amount'
  nextBillingDate?: any; // For recurring subscriptions
  trialEndDate?: any;
  price?: number; // Price at the time of subscription/renewal
  currency?: string;
  interval?: 'month' | 'year' | string;
  paymentMethod?: Partial<CardDetails>; // Store only non-sensitive info like last4, brand
  autoRenew: boolean;
  // Add other properties like Stripe subscription ID, customer ID, etc.
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService
  ) {}

  /**
   * Get subscription details for a user.
   * Fetches the latest active or trialing subscription.
   */
  getSubscription(userId: string): Observable<SubscriptionDetails | null> {
    return this.firestore
      .collection<SubscriptionDetails>('subscriptions', ref =>
        ref.where('userId', '==', userId)
           .where('status', 'in', ['active', 'trialing', 'past_due', 'incomplete']) // Relevant statuses
           .orderBy('startDate', 'desc')
           .limit(1)
      )
      .valueChanges({ idField: 'id' })
      .pipe(
        map(subscriptions => (subscriptions.length > 0 ? subscriptions[0] : null)),
        catchError(error => {
          console.error("Error fetching subscription:", error);
          return of(null);
        })
      );
  }

  /**
   * Get available subscription plans.
   * @param userType Filters plans for 'retailer' or 'customer'.
   */
  getAvailablePlans(userType: 'retailer' | 'customer'): Observable<Plan[]> {
    // In a real app, fetch this from a 'plans' collection in Firestore
    // or a configuration file.
    const allPlans: Plan[] = [
      { id: 'retailer_basic_monthly', name: 'Retailer Basic Monthly', price: 29, currency: 'USD', interval: 'month', description: 'Essential features for retailers.', userType: 'retailer' },
      { id: 'retailer_pro_monthly', name: 'Retailer Pro Monthly', price: 79, currency: 'USD', interval: 'month', description: 'Advanced features and support.', userType: 'retailer' },
      { id: 'retailer_basic_yearly', name: 'Retailer Basic Yearly', price: 290, currency: 'USD', interval: 'year', description: 'Save with annual billing for essential features.', userType: 'retailer' },
      // Add more plans as needed
    ];
    return of(allPlans.filter(plan => plan.userType === userType || plan.userType === 'all'));
  }

  /**
   * Creates a new subscription for a user.
   * This would typically involve integrating with a payment provider.
   */
  createSubscription(userId: string, planId: string): Observable<string | null> {
    // 1. Fetch plan details (to get price, interval etc.)
    // 2. Integrate with Stripe/Payment Provider to setup subscription & initial payment
    // 3. On successful payment, create the subscription document in Firestore.

    // Simplified example:
    return from(this.getAvailablePlans('retailer').pipe( // Assuming retailer for now
      map(plans => plans.find(p => p.id === planId)),
      switchMap(async (planDetails) => {
        if (!planDetails) {
          throw new Error(`Plan with ID ${planId} not found.`);
        }

        const subscriptionId = this.firestore.createId();
        const now = new Date();
        const nextBilling = new Date(now);
        if (planDetails.interval === 'month') {
          nextBilling.setMonth(now.getMonth() + 1);
        } else if (planDetails.interval === 'year') {
          nextBilling.setFullYear(now.getFullYear() + 1);
        }
        // Handle trial periods if applicable for new subscriptions from specific plans
        const trialDays = 0; // Example: planDetails.trialPeriodDays || 0;
        const trialEndDate = trialDays > 0 ? new Date(now.setDate(now.getDate() + trialDays)) : undefined;


        const newSubscription: SubscriptionDetails = {
          id: subscriptionId,
          userId,
          planId,
          planName: planDetails.name,
          status: trialDays > 0 ? 'trialing' : 'active',
          startDate: new Date(), // Firestore server timestamp is better here
          endDate: trialDays > 0 ? trialEndDate : nextBilling, // For trial, endDate is trial end. For active, it's next billing.
          nextBillingDate: trialDays > 0 ? undefined : nextBilling, // No next billing during trial if payment is after trial
          trialEndDate: trialEndDate,
          price: planDetails.price,
          currency: planDetails.currency,
          interval: planDetails.interval,
          autoRenew: true,
          // paymentMethod: {} // This would be set after successful payment setup
          // stripeSubscriptionId: 'stripe_sub_id_from_payment_gateway'
        };

        await this.firestore.collection('subscriptions').doc(subscriptionId).set(newSubscription);
        await this.authService.updateProfile(userId, {
          hasActiveSubscription: true,
          subscriptionStatus: newSubscription.status,
          subscriptionEndDate: newSubscription.endDate
        });
        return subscriptionId;
      }),
      catchError(error => {
        console.error("Error creating subscription:", error);
        return of(null); // Return null or throw error
      })
    ).toPromise()); // Using toPromise() as firstValueFrom is for observables that emit at least one value
  }


  /**
   * Updates an existing subscription (e.g., changing plans).
   */
  updateSubscription(userId: string, currentSubscriptionId: string, newPlanId: string): Observable<void> {
    // 1. Fetch new plan details.
    // 2. Integrate with Stripe/Payment Provider to update the subscription (handle proration etc.).
    // 3. On success, update the Firestore subscription document.

    // Simplified example:
    return from(this.getAvailablePlans('retailer').pipe( // Assuming retailer
      map(plans => plans.find(p => p.id === newPlanId)),
      switchMap(async (newPlanDetails) => {
        if (!newPlanDetails) {
          throw new Error(`New plan with ID ${newPlanId} not found.`);
        }
        const now = new Date();
        const nextBilling = new Date(now);
         if (newPlanDetails.interval === 'month') {
          nextBilling.setMonth(now.getMonth() + 1);
        } else if (newPlanDetails.interval === 'year') {
          nextBilling.setFullYear(now.getFullYear() + 1);
        }

        const updates: Partial<SubscriptionDetails> = {
          planId: newPlanDetails.id,
          planName: newPlanDetails.name,
          price: newPlanDetails.price,
          currency: newPlanDetails.currency,
          interval: newPlanDetails.interval,
          status: 'active', // Assuming plan change makes it active
          startDate: new Date(), // Or keep original start date and log change date
          endDate: nextBilling, // This would be the new cycle end date
          nextBillingDate: nextBilling,
          // autoRenew might change based on new plan
        };
        await this.firestore.collection('subscriptions').doc(currentSubscriptionId).update(updates);
        await this.authService.updateProfile(userId, {
            subscriptionStatus: 'active',
            subscriptionEndDate: updates.endDate
        });
      })
    ));
  }

  /**
   * Cancel a subscription.
   */
  cancelSubscription(subscriptionId: string, userId: string): Observable<void> {
    if (!subscriptionId || !userId) {
      return from(Promise.reject(new Error('Subscription ID or User ID is missing.')));
    }
    // In a real app, this would also interact with the payment gateway to cancel recurring billing.
    const updates = {
      status: 'cancelled',
      autoRenew: false,
      // endDate might remain as the end of the current paid period.
      // cancellationDate: new Date() // Optionally add a cancellation date
    };
    return from(this.firestore.collection('subscriptions').doc(subscriptionId).update(updates)).pipe(
      switchMap(() => {
        return from(this.authService.updateProfile(userId, {
          hasActiveSubscription: false, // Or true until endDate
          subscriptionStatus: 'cancelled'
          // subscriptionEndDate could remain to show when access expires
        }));
      }),
      catchError(error => {
          console.error("Error cancelling subscription:", error);
          throw error; // Re-throw to be caught by the component
      })
    );
  }

  /**
   * Process a new subscription (typically initial sign-up with trial).
   * In a real application, this would involve secure payment gateway integration.
   */
  processSubscription(userId: string, cardDetails: CardDetails, planId: string = 'retailer_basic_monthly'): Observable<string | null> {
    if (!userId || !cardDetails) {
      return from(Promise.reject(new Error('User ID or Card Details are missing.')));
    }
    // This method is more for an initial signup flow with a trial.
    // For plan changes or direct subscriptions, use createSubscription or updateSubscription.

    return from(this.getAvailablePlans('retailer').pipe(
        map(plans => plans.find(p => p.id === planId)),
        switchMap(async (planDetails) => {
            if (!planDetails) {
                throw new Error(`Default plan ${planId} not found for trial.`);
            }
            const subscriptionId = this.firestore.createId();
            const now = new Date();
            const trialDays = 30; // Example: 30-day trial
            const trialEndDate = new Date();
            trialEndDate.setDate(now.getDate() + trialDays);

            const subscription: SubscriptionDetails = {
              id: subscriptionId,
              userId: userId,
              planId: planDetails.id,
              planName: planDetails.name,
              status: 'trialing',
              startDate: now,
              endDate: trialEndDate, // End of trial period
              trialEndDate: trialEndDate,
              price: planDetails.price, // Price that will be charged after trial
              currency: planDetails.currency,
              interval: planDetails.interval,
              paymentMethod: {
                cardNumber: `**** **** **** ${cardDetails.cardNumber.slice(-4)}`,
                expiryMonth: cardDetails.expiryMonth,
                expiryYear: cardDetails.expiryYear,
                name: cardDetails.name
              },
              autoRenew: true
            };
            await this.firestore.collection('subscriptions').doc(subscriptionId).set(subscription);
            await this.authService.updateProfile(userId, {
              hasActiveSubscription: true, // Or a specific 'hasTrial' flag
              subscriptionStatus: 'trialing',
              subscriptionEndDate: trialEndDate
            });
            return subscriptionId;
        }),
        catchError(error => {
            console.error("Error processing trial subscription:", error);
            return of(null);
        })
    ).toPromise());
  }


  // --- Validation Methods (can be kept or moved to a utility service) ---
  validateCreditCard(cardNumber: string): boolean {
    if (!cardNumber) return false;
    const cleanedCardNumber = cardNumber.replace(/[\s-]/g, '');
    if (!/^\d+$/.test(cleanedCardNumber)) return false;
    if (cleanedCardNumber.length < 13 || cleanedCardNumber.length > 19) return false;
    let sum = 0;
    let doubled = false;
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

  validateCVC(cvc: string, cardType: string = 'unknown'): boolean {
    if (!cvc) return false;
    const cleanedCVC = cvc.trim();
    if (!/^\d+$/.test(cleanedCVC)) return false;
    if (cardType.toLowerCase() === 'amex') {
      return cleanedCVC.length === 4;
    }
    return cleanedCVC.length === 3;
  }

  validateExpiry(month: string, year: string): boolean {
    if (!month || !year) return false;
    const currentDate = new Date();
    currentDate.setDate(1); 
    currentDate.setHours(0, 0, 0, 0);
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const expMonth = parseInt(month, 10);
    const expYear = parseInt(year, 10);
    if (isNaN(expMonth) || isNaN(expYear) || expMonth < 1 || expMonth > 12) return false;
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) return false;
    return true;
  }

  // Method for Stripe Billing Portal (example, requires backend integration)
  // async getBillingPortalUrl(userId: string): Promise<string | null> {
  //   try {
  //     const callable = this.functions.httpsCallable('stripeCreateBillingPortalSession');
  //     const result = await callable({ customerId: 'cus_xxxx' /* Get Stripe customer ID for user */ }).toPromise();
  //     return result?.url || null;
  //   } catch (error) {
  //     console.error('Error creating billing portal session:', error);
  //     return null;
  //   }
  // }
}
