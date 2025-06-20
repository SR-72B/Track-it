// src/app/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError, take, tap } from 'rxjs/operators';
import firebase from 'firebase/compat/app';

// User interface defining the structure of your user objects
export interface User {
  uid: string;
  email: string | null;
  accountType: 'retailer' | 'customer';
  displayName?: string | null;
  phoneNumber?: string | null;
  emailVerified: boolean;
  hasActiveSubscription?: boolean;
  subscriptionEndDate?: any;
  subscriptionStatus?: 'active' | 'cancelled' | 'trialing' | 'expired' | 'pending_payment' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'ended' | string;
  createdAt?: any;
  updatedAt?: any;
  profileImageUrl?: string;
  isActive?: boolean;
  lastLoginAt?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router
  ) {
    this.initializeAuthState();
  }

  /**
   * Initialize authentication state monitoring
   */
  private initializeAuthState(): void {
    this.afAuth.authState.pipe(
      switchMap(firebaseUser => {
        if (firebaseUser) {
          return this.getUserData(firebaseUser.uid).pipe(
            map(userDataFromDb => {
              if (userDataFromDb) {
                return this.combineUserData(firebaseUser, userDataFromDb);
              }
              
              console.warn(`No Firestore data found for user ${firebaseUser.uid}. User profile is incomplete.`);
              return this.createFallbackUser(firebaseUser);
            }),
            catchError(error => {
              console.error("Error fetching user data from Firestore:", error);
              this.currentUserSubject.next(null);
              return of(null);
            })
          );
        } else {
          return of(null);
        }
      }),
      catchError(error => {
        console.error("Error in auth state initialization:", error);
        return of(null);
      })
    ).subscribe({
      next: (user) => {
        this.currentUserSubject.next(user);
      },
      error: (error) => {
        console.error("Auth state subscription error:", error);
        this.currentUserSubject.next(null);
      }
    });
  }

  /**
   * Combine Firebase Auth data with Firestore data
   */
  private combineUserData(firebaseUser: firebase.User, userDataFromDb: any): User {
    // Convert Firestore Timestamps to JS Date objects
    const subEndDate = this.convertTimestamp(userDataFromDb.subscriptionEndDate);
    const creationDate = this.convertTimestamp(userDataFromDb.createdAt);
    const updatedDate = this.convertTimestamp(userDataFromDb.updatedAt);
    const lastLogin = this.convertTimestamp(userDataFromDb.lastLoginAt);

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      emailVerified: firebaseUser.emailVerified,
      displayName: firebaseUser.displayName || userDataFromDb.displayName,
      phoneNumber: firebaseUser.phoneNumber || userDataFromDb.phoneNumber,
      accountType: userDataFromDb.accountType || 'customer',
      hasActiveSubscription: userDataFromDb.hasActiveSubscription || false,
      subscriptionStatus: userDataFromDb.subscriptionStatus,
      subscriptionEndDate: subEndDate,
      createdAt: creationDate,
      updatedAt: updatedDate,
      lastLoginAt: lastLogin,
      profileImageUrl: userDataFromDb.profileImageUrl,
      isActive: userDataFromDb.isActive !== false
    };
  }

  /**
   * Create fallback user when Firestore data is missing
   */
  private createFallbackUser(firebaseUser: firebase.User): User {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      emailVerified: firebaseUser.emailVerified,
      displayName: firebaseUser.displayName,
      phoneNumber: firebaseUser.phoneNumber,
      accountType: 'customer',
      hasActiveSubscription: false,
      isActive: true
    };
  }

  /**
   * Convert Firestore Timestamp to Date
   */
  private convertTimestamp(timestamp: any): Date | undefined {
    if (!timestamp) return undefined;
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    }
    try {
      return new Date(timestamp);
    } catch (error) {
      console.warn('Invalid timestamp format:', timestamp);
      return undefined;
    }
  }

  /**
   * Retrieves user data document from Firestore
   */
  getUserData(uid: string): Observable<User | undefined> {
    if (!uid) {
      return of(undefined);
    }
    
    return this.firestore.doc<User>(`users/${uid}`).valueChanges().pipe(
      catchError(error => {
        console.error(`Error fetching user data for ${uid}:`, error);
        return of(undefined);
      })
    );
  }

  /**
   * Signs up a new user
   */
  async signup(email: string, password: string, displayName: string, accountType: 'retailer' | 'customer'): Promise<firebase.auth.UserCredential> {
    if (!email || !password || !displayName || !accountType) {
      throw new Error('All fields are required for signup.');
    }

    try {
      const result = await this.afAuth.createUserWithEmailAndPassword(email, password);
      if (!result.user) {
        throw new Error('User creation failed: No user object returned from Firebase Auth.');
      }

      // Update Firebase Auth profile
      await result.user.updateProfile({ displayName: displayName });

      // Send email verification
      await result.user.sendEmailVerification();

      // Create Firestore user document
      const userData: Partial<User> = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: displayName,
        accountType: accountType,
        emailVerified: false,
        hasActiveSubscription: false,
        isActive: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await this.firestore.doc(`users/${result.user.uid}`).set(userData);

      return result;
    } catch (error) {
      console.error("Signup error in AuthService:", error);
      throw error;
    }
  }

  /**
   * Logs in an existing user
   */
  async login(email: string, password: string): Promise<firebase.auth.UserCredential> {
    if (!email || !password) {
      throw new Error('Email and password are required for login.');
    }

    try {
      const result = await this.afAuth.signInWithEmailAndPassword(email, password);
      
      // Update last login time
      if (result.user) {
        await this.updateLastLoginTime(result.user.uid);
      }
      
      return result;
    } catch (error) {
      console.error("Login error in AuthService:", error);
      throw error;
    }
  }

  /**
   * Update last login time
   */
  private async updateLastLoginTime(uid: string): Promise<void> {
    if (!uid) return;
    
    try {
      await this.firestore.doc(`users/${uid}`).update({
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.warn('Failed to update last login time:', error);
    }
  }

  /**
   * Logs out the current user
   */
  async logout(): Promise<void> {
    try {
      await this.afAuth.signOut();
      this.currentUserSubject.next(null);
      this.router.navigate(['/auth/login']);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }

  /**
   * Sends a verification email
   */
  async sendVerificationEmail(): Promise<void> {
    try {
      const user = await firstValueFrom(this.afAuth.authState.pipe(take(1)));
      if (!user) {
        throw new Error('No authenticated user to send verification email.');
      }
      await user.sendEmailVerification();
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  }

  /**
   * Sends a password reset email
   */
  async resetPassword(email: string): Promise<void> {
    if (!email) {
      throw new Error('Email is required for password reset.');
    }

    try {
      await this.afAuth.sendPasswordResetEmail(email);
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  }

  /**
   * Updates user profile
   */
  async updateProfile(uid: string, data: Partial<User>): Promise<void> {
    if (!uid) {
      throw new Error('UID is required to update profile.');
    }

    if (!data || Object.keys(data).length === 0) {
      throw new Error('Update data is required.');
    }

    try {
      // Prepare Firebase Auth profile updates
      const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};
      if (data.displayName !== undefined) {
        authProfileUpdates.displayName = data.displayName;
      }
      if (data.profileImageUrl !== undefined) {
        authProfileUpdates.photoURL = data.profileImageUrl;
      }

      // Update Firebase Auth profile if needed
      if (Object.keys(authProfileUpdates).length > 0) {
        const user = await firstValueFrom(this.afAuth.authState.pipe(take(1)));
        if (user && user.uid === uid) {
          await user.updateProfile(authProfileUpdates);
        }
      }

      // Update Firestore document
      const updateData = {
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await this.firestore.doc(`users/${uid}`).update(updateData);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Updates user password
   */
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!currentPassword || !newPassword) {
      throw new Error('Current password and new password are required.');
    }

    try {
      const user = await firstValueFrom(this.afAuth.authState.pipe(take(1)));
      if (!user || !user.email) {
        throw new Error('No authenticated user or user email is missing for password update.');
      }

      // Re-authenticate user
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);

      // Update password
      await user.updatePassword(newPassword);

      // Update timestamp in Firestore
      await this.firestore.doc(`users/${user.uid}`).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error("Password update error:", error);
      throw error;
    }
  }

  /**
   * Checks if current user is a retailer
   */
  isRetailer(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user && user.accountType === 'retailer')
    );
  }

  /**
   * Checks if current user is a customer
   */
  isCustomer(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user && user.accountType === 'customer')
    );
  }

  /**
   * Checks if current user has active subscription
   */
  hasActiveSubscription(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user?.hasActiveSubscription)
    );
  }

  /**
   * Gets current user synchronously
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Checks if user is authenticated
   */
  isAuthenticated(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user)
    );
  }

  /**
   * Checks if user email is verified
   */
  isEmailVerified(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user?.emailVerified)
    );
  }

  /**
   * Deletes user account
   */
  async deleteAccount(): Promise<void> {
    try {
      const user = await firstValueFrom(this.afAuth.authState.pipe(take(1)));
      if (!user) {
        throw new Error('No authenticated user to delete.');
      }

      // Delete Firestore document first
      await this.firestore.doc(`users/${user.uid}`).delete();

      // Delete Firebase Auth account
      await user.delete();

      // Clear current user and navigate to login
      this.currentUserSubject.next(null);
      this.router.navigate(['/auth/login']);
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  /**
   * Refresh current user data from Firestore
   */
  async refreshUserData(): Promise<void> {
    const currentUser = this.getCurrentUser();
    if (currentUser?.uid) {
      try {
        const userData = await firstValueFrom(this.getUserData(currentUser.uid));
        if (userData) {
          const firebaseUser = await firstValueFrom(this.afAuth.authState.pipe(take(1)));
          if (firebaseUser) {
            const updatedUser = this.combineUserData(firebaseUser, userData);
            this.currentUserSubject.next(updatedUser);
          }
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  }
}
