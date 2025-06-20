// src/app/payment/payment.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../auth/auth.service';
import { Observable, from, of, firstValueFrom } from 'rxjs';
import { switchMap, map, catchError, take } from 'rxjs/operators';
import firebase from 'firebase/compat/app';

export interface CardDetails {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
  name: string;
  isDefault?: boolean; // Added optional property
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | string;
  description?: string;
  features?: string[];
  userType?: 'retailer' | 'customer' | 'all';
  trialPeriodDays?: number;
}

export interface SubscriptionDetails {
  id: string;
  userId: string;
  planId: string;
  planName?: string;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'ended' | string;
  startDate: any;
  endDate?: any;
  amount?: number;
  nextBillingDate?: any;
  trialEndDate?: any;
  price?: number;
  currency?: string;
  interval?: 'month' | 'year' | string;
  paymentMethod?: Partial<CardDetails>;
  autoRenew: boolean;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  createdAt?: any;
  updatedAt?: any;
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
   * Get subscription details for a user
   */
  getSubscription(userId: string): Observable<SubscriptionDetails | null> {
    if (!userId) {
      return of(null);
    }

    return this.firestore
      .collection<SubscriptionDetails>('subscriptions', ref =>
        ref.where('userId', '==', userId)
           .where('status', 'in', ['active', 'trialing', 'past_due', 'incomplete'])
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
   * Get all subscriptions for a user (including cancelled ones)
   */
  getUserSubscriptions(userId: string): Observable<SubscriptionDetails[]> {
    if (!userId) {
      return of([]);
    }

    return this.firestore
      .collection<SubscriptionDetails>('subscriptions', ref =>
        ref.where('userId', '==', userId)
           .orderBy('startDate', 'desc')
      )
      .valueChanges({ idField: 'id' })
      .pipe(
        catchError(error => {
          console.error("Error fetching user subscriptions:", error);
          return of([]);
        })
      );
  }

  /**
   * Get available subscription plans
   */
  getAvailablePlans(userType: 'retailer' | 'customer'): Observable<Plan[]> {
    const allPlans: Plan[] = [
      { 
        id: 'retailer_basic_monthly', 
        name: 'Retailer Basic Monthly', 
        price: 29, 
        currency: 'USD', 
        interval: 'month', 
        description: 'Essential features for retailers.', 
        userType: 'retailer',
        trialPeriodDays: 30,
        features: ['Order Management', 'Customer Communication', 'Basic Analytics']
      },
      { 
        id: 'retailer_pro_monthly', 
        name: 'Retailer Pro Monthly', 
        price: 79, 
        currency: 'USD', 
        interval: 'month', 
        description: 'Advanced features and support.', 
        userType: 'retailer',
        trialPeriodDays: 14,
        features: ['All Basic Features', 'Advanced Analytics', 'Priority Support', 'Custom Forms']
      },
      { 
        id: 'retailer_basic_yearly', 
        name: 'Retailer Basic Yearly', 
        price: 290, 
        currency: 'USD', 
        interval: 'year', 
        description: 'Save with annual billing for essential features.', 
        userType: 'retailer',
        trialPeriodDays: 30,
        features: ['Order Management', 'Customer Communication', 'Basic Analytics', '2 Months Free']
      }
    ];
    
    return of(allPlans.filter(plan => plan.userType === userType || plan.userType === 'all'));
  }

  /**
   * Creates a new subscription for a user
   */
  createSubscription(userId: string, planId: string): Observable<string> {
    if (!userId || !planId) {
      return from(Promise.reject(new Error('User ID and Plan ID are required.')));
    }

    return this.getAvailablePlans('retailer').pipe(
      map(plans => plans.find(p => p.id === planId)),
      switchMap(async (planDetails) => {
        if (!planDetails) {
          throw new Error(`Plan with ID ${planId} not found.`);
        }

        const subscriptionId = this.firestore.createId();
        const now = firebase.firestore.FieldValue.serverTimestamp();
        const nextBilling = new Date();
        
        if (planDetails.interval === 'month') {
          nextBilling.setMonth(nextBilling.getMonth() + 1);
        } else if (planDetails.interval === 'year') {
          nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        }

        const trialDays = planDetails.trialPeriodDays || 0;
        const trialEndDate = trialDays > 0 ? new Date(Date.now() + (trialDays * 24 * 60 * 60 * 1000)) : undefined;

        const newSubscription: SubscriptionDetails = {
          id: subscriptionId,
          userId,
          planId,
          planName: planDetails.name,
          status: trialDays > 0 ? 'trialing' : 'active',
          startDate: now,
          endDate: trialDays > 0 ? trialEndDate : nextBilling,
          nextBillingDate: trialDays > 0 ? nextBilling : nextBilling,
          trialEndDate: trialEndDate,
          price: planDetails.price,
          currency: planDetails.currency,
          interval: planDetails.interval,
          autoRenew: true,
          createdAt: now,
          updatedAt: now
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
        throw error;
      })
    );
  }

  /**
   * Updates an existing subscription
   */
  updateSubscription(userId: string, currentSubscriptionId: string, newPlanId: string): Observable<void> {
    if (!userId || !currentSubscriptionId || !newPlanId) {
      return from(Promise.reject(new Error('User ID, Subscription ID, and New Plan ID are required.')));
    }

    return this.getAvailablePlans('retailer').pipe(
      map(plans => plans.find(p => p.id === newPlanId)),
      switchMap(async (newPlanDetails) => {
        if (!newPlanDetails) {
          throw new Error(`New plan with ID ${newPlanId} not found.`);
        }

        const nextBilling = new Date();
        if (newPlanDetails.interval === 'month') {
          nextBilling.setMonth(nextBilling.getMonth() + 1);
        } else if (newPlanDetails.interval === 'year') {
          nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        }

        const updates: Partial<SubscriptionDetails> = {
          planId: newPlanDetails.id,
          planName: newPlanDetails.name,
          price: newPlanDetails.price,
          currency: newPlanDetails.currency,
          interval: newPlanDetails.interval,
          status: 'active',
          endDate: nextBilling,
          nextBillingDate: nextBilling,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await this.firestore.collection('subscriptions').doc(currentSubscriptionId).update(updates);
        
        await this.authService.updateProfile(userId, {
          subscriptionStatus: 'active',
          subscriptionEndDate: updates.endDate
        });
      }),
      catchError(error => {
        console.error("Error updating subscription:", error);
        throw error;
      })
    );
  }

  /**
   * Cancel a subscription
   */
  cancelSubscription(subscriptionId: string, userId: string): Observable<void> {
    if (!subscriptionId || !userId) {
      return from(Promise.reject(new Error('Subscription ID and User ID are required.')));
    }

    const updates: Partial<SubscriptionDetails> = {
      status: 'cancelled',
      autoRenew: false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    return from(this.firestore.collection('subscriptions').doc(subscriptionId).update(updates)).pipe(
      switchMap(() => {
        return from(this.authService.updateProfile(userId, {
          hasActiveSubscription: false,
          subscriptionStatus: 'cancelled'
        }));
      }),
      catchError(error => {
        console.error("Error cancelling subscription:", error);
        throw error;
      })
    );
  }

  /**
   * Process a new subscription with trial
   */
  processSubscription(userId: string, cardDetails: CardDetails, planId: string = 'retailer_basic_monthly'): Observable<string> {
    if (!userId || !cardDetails) {
      return from(Promise.reject(new Error('User ID and Card Details are required.')));
    }

    return this.getAvailablePlans('retailer').pipe(
      map(plans => plans.find(p => p.id === planId)),
      switchMap(async (planDetails) => {
        if (!planDetails) {
          throw new Error(`Plan ${planId} not found.`);
        }

        const subscriptionId = this.firestore.createId();
        const now = firebase.firestore.FieldValue.serverTimestamp();
        const trialDays = planDetails.trialPeriodDays || 30;
        const trialEndDate = new Date(Date.now() + (trialDays * 24 * 60 * 60 * 1000));

        const subscription: SubscriptionDetails = {
          id: subscriptionId,
          userId: userId,
          planId: planDetails.id,
          planName: planDetails.name,
          status: 'trialing',
          startDate: now,
          endDate: trialEndDate,
          trialEndDate: trialEndDate,
          price: planDetails.price,
          currency: planDetails.currency,
          interval: planDetails.interval,
          paymentMethod: {
            cardNumber: `**** **** **** ${cardDetails.cardNumber.slice(-4)}`,
            expiryMonth: cardDetails.expiryMonth,
            expiryYear: cardDetails.expiryYear,
            name: cardDetails.name
          },
          autoRenew: true,
          createdAt: now,
          updatedAt: now
        };

        await this.firestore.collection('subscriptions').doc(subscriptionId).set(subscription);
        
        await this.authService.updateProfile(userId, {
          hasActiveSubscription: true,
          subscriptionStatus: 'trialing',
          subscriptionEndDate: trialEndDate
        });
        
        return subscriptionId;
      }),
      catchError(error => {
        console.error("Error processing trial subscription:", error);
        throw error;
      })
    );
  }

  /**
   * Check if subscription is expired
   */
  isSubscriptionExpired(subscription: SubscriptionDetails): boolean {
    if (!subscription.endDate) return false;
    
    const endDate = this.convertTimestamp(subscription.endDate);
    return endDate ? new Date() > endDate : false;
  }

  /**
   * Get days remaining in subscription
   */
  getDaysRemaining(subscription: SubscriptionDetails): number {
    if (!subscription.endDate) return 0;
    
    const endDate = this.convertTimestamp(subscription.endDate);
    if (!endDate) return 0;
    
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Convert Firestore Timestamp to Date
   */
  private convertTimestamp(timestamp: any): Date | null {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    }
    try {
      return new Date(timestamp);
    } catch (error) {
      console.warn('Invalid timestamp format:', timestamp);
      return null;
    }
  }

  // Validation Methods
  validateCreditCard(cardNumber: string): boolean {
    if (!cardNumber) return false;
    const cleanedCardNumber = cardNumber.replace(/[\s-]/g, '');
    if (!/^\d+$/.test(cleanedCardNumber)) return false;
    if (cleanedCardNumber.length < 13 || cleanedCardNumber.length > 19) return false;
    
    // Luhn algorithm
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

  /**
   * Get card type from card number
   */
  getCardType(cardNumber: string): string {
    const cleanedNumber = cardNumber.replace(/[\s-]/g, '');
    
    if (/^4/.test(cleanedNumber)) return 'visa';
    if (/^5[1-5]/.test(cleanedNumber)) return 'mastercard';
    if (/^3[47]/.test(cleanedNumber)) return 'amex';
    if (/^6/.test(cleanedNumber)) return 'discover';
    
    return 'unknown';
  }
}
