// src/app/shared/models/user.model.ts
export interface User {
    uid: string;
    email: string;
    displayName?: string;
    phoneNumber?: string;
    accountType: 'retailer' | 'customer';
    emailVerified: boolean;
    hasActiveSubscription?: boolean;
    subscriptionEndDate?: Date;
    createdAt: Date;
  }