// src/app/shared/models/user.model.ts
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  phoneNumber?: string;
  accountType: 'retailer' | 'customer';
  emailVerified: boolean;
  hasActiveSubscription?: boolean;
  subscriptionEndDate?: any; // Firestore Timestamp or Date
  createdAt: any; // Firestore Timestamp or Date
  updatedAt?: any; // Firestore Timestamp or Date
  profileImageUrl?: string;
  isActive?: boolean;
  lastLoginAt?: any; // Firestore Timestamp or Date
  preferences?: UserPreferences;
  metadata?: { [key: string]: any };
}

// User account types for better type safety
export type AccountType = 'retailer' | 'customer';

// User preferences interface
export interface UserPreferences {
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  language?: string;
  timezone?: string;
  theme?: 'light' | 'dark' | 'auto';
}

// User profile update interface
export interface UserProfileUpdate {
  displayName?: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  preferences?: Partial<UserPreferences>;
}

// User authentication state
export interface UserAuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// User subscription info
export interface UserSubscription {
  isActive: boolean;
  planType?: string;
  startDate?: any; // Firestore Timestamp or Date
  endDate?: any; // Firestore Timestamp or Date
  status?: 'active' | 'cancelled' | 'expired' | 'trial';
}
